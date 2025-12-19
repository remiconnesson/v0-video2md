/**
 * YouTube video download service.
 * Ported from Python: src/slides_extractor/downloader.py
 *
 * Uses youtubei.js for YouTube video extraction.
 */

import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Innertube, UniversalCache, Utils } from "youtubei.js";
import { DEFAULT_USER_AGENT, TEMP_DIR } from "./config";
import type { DownloadResult, StreamUrls } from "./types";

type VideoInfo = Awaited<ReturnType<typeof Innertube.prototype.getInfo>>;
type StreamingFormat = NonNullable<
  VideoInfo["streaming_data"]
>["formats"][number];

let ytClientPromise: Promise<Innertube> | null = null;

async function getClient(): Promise<Innertube> {
  "use step";
  if (!ytClientPromise) {
    ytClientPromise = Innertube.create({
      cache: new UniversalCache(false),
      user_agent: DEFAULT_USER_AGENT,
      generate_session_locally: true,
    });
  }

  return ytClientPromise;
}

function extractVideoId(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    if (url.hostname === "youtu.be") {
      return url.pathname.replace(/^\//, "");
    }

    const videoId = url.searchParams.get("v");
    if (videoId) return videoId;

    const pathParts = url.pathname.split("/");
    const embedIndex = pathParts.indexOf("embed");
    if (embedIndex !== -1 && pathParts[embedIndex + 1]) {
      return pathParts[embedIndex + 1];
    }
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(videoUrl)) {
      return videoUrl;
    }
  }

  return null;
}

function isMp4Format(format: StreamingFormat): boolean {
  return (format.mime_type || "").includes("mp4");
}

function collectFormats(info: VideoInfo): StreamingFormat[] {
  const streamingData = info.streaming_data;
  if (!streamingData) {
    console.warn("No streaming_data available in video info");
    return [];
  }

  const formats = streamingData.formats || [];
  const adaptiveFormats = streamingData.adaptive_formats || [];

  console.log(
    `Collected formats: ${formats.length} standard, ${adaptiveFormats.length} adaptive`,
  );

  return [...formats, ...adaptiveFormats];
}

async function getFormatUrl(
  format: StreamingFormat,
  client: Innertube,
): Promise<string | null> {
  "use step";
  if (typeof format.decipher === "function") {
    try {
      const deciphered = await format.decipher(client.session.player);
      if (deciphered) return deciphered;
    } catch (error: unknown) {
      console.error(
        "Failed to decipher format URL:",
        (error as Error).message || error,
      );
    }
  }

  return format.url || null;
}

// Re-export types
export type { DownloadResult, StreamUrls };

/**
 * Get video and audio stream URLs from YouTube.
 * Ported from Python: get_stream_urls()
 */
export async function getStreamUrls(videoUrl: string): Promise<StreamUrls> {
  "use step";
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      console.error("Invalid YouTube URL");
      return { videoUrl: null, audioUrl: null, title: null };
    }

    const client = await getClient();
    const info = (await client.getInfo(videoId)) as VideoInfo;

    const formats = collectFormats(info);
    const videoFormats = formats
      .filter(
        (format) =>
          format.has_video &&
          !format.has_audio &&
          isMp4Format(format) &&
          (format.height || 0) <= 720,
      )
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    const audioFormats = formats
      .filter(
        (format) =>
          format.has_audio && !format.has_video && isMp4Format(format),
      )
      .sort(
        (a, b) =>
          (b.bitrate || b.average_bitrate || 0) -
          (a.bitrate || a.average_bitrate || 0),
      );

    const videoFormat = videoFormats[0];
    const audioFormat = audioFormats[0];

    if (!videoFormat) {
      console.error("No suitable video format found");
      return { videoUrl: null, audioUrl: null, title: null };
    }

    const [videoUrlResolved, audioUrlResolved] = await Promise.all([
      getFormatUrl(videoFormat, client),
      audioFormat ? getFormatUrl(audioFormat, client) : Promise.resolve(null),
    ]);

    if (!videoUrlResolved) {
      console.error("Unable to resolve video URL after deciphering");
      return {
        videoUrl: null,
        audioUrl: null,
        title: info.basic_info?.title || null,
      };
    }

    console.log(
      `Found video stream: ${videoFormat.height || "unknown"}p, audio bitrate: ${
        audioFormat?.bitrate || audioFormat?.average_bitrate || "none"
      }`,
    );

    return {
      videoUrl: videoUrlResolved,
      audioUrl: audioUrlResolved,
      title: info.basic_info?.title || null,
    };
  } catch (error: unknown) {
    console.error(
      "Failed to get stream URLs:",
      (error as Error).message || error,
    );
    return { videoUrl: null, audioUrl: null, title: null };
  }
}

function isVideoFormat(format: StreamingFormat): boolean {
  const mimeType = format.mime_type || "";
  return mimeType.includes("mp4") || mimeType.includes("webm");
}

/**
 * Download a video directly using youtubei.js stream URLs.
 * This is simpler and works well for Vercel.
 */
export async function downloadVideoWithYtdl(
  videoUrl: string,
  outputPath: string,
): Promise<DownloadResult> {
  "use step";
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return { success: false, error: "Invalid YouTube URL" };
    }

    const client = await getClient();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    const stream = await client.download(videoId, {
      type: "video",
      quality: "best",
      format: "mp4",
    });

    const writeStream = createWriteStream(outputPath);

    for await (const chunk of Utils.streamToIterable(stream)) {
      writeStream.write(chunk);
    }

    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    return { success: true, path: outputPath };
  } catch (error: unknown) {
    const err = toError(error);
    console.error("Download failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Download a file from a direct URL (for pre-extracted stream URLs).
 */
export async function downloadVideo(
  url: string,
  outputPath: string,
): Promise<DownloadResult> {
  "use step";
  try {
    const headers = getDefaultHeaders();

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Get file size first
    const totalSize = await getFileSize(url, headers);
    console.log(
      `Starting download: ${(totalSize / 1024 / 1024).toFixed(1)} MB`,
    );

    // Download with streaming
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const writeStream = createWriteStream(outputPath);
    const reader = response.body?.getReader();

    if (!reader) {
      return { success: false, error: "No response body" };
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      writeStream.write(value);
    }

    writeStream.end();

    // Wait for write to complete
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    console.log(`Downloaded: ${outputPath}`);

    return { success: true, path: outputPath };
  } catch (error: unknown) {
    const err = toError(error);
    console.error("Download failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get file size from URL using HEAD request or content-length query param.
 */
export async function getFileSize(
  url: string,
  headers: Record<string, string>,
): Promise<number> {
  "use step";
  // Try to get size from URL query param (YouTube often includes this)
  const urlObj = new URL(url);
  const clen = urlObj.searchParams.get("clen");
  if (clen) {
    const size = Number.parseInt(clen, 10);
    if (size > 0) return size;
  }

  // Try HEAD request
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers,
    });

    if (response.ok) {
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const size = Number.parseInt(contentLength, 10);
        if (size > 0) return size;
      }
    }
  } catch {
    // Ignore HEAD failures
  }

  return 0;
}

/**
 * Get default request headers.
 */
function getDefaultHeaders(): Record<string, string> {
  return {
    "User-Agent": DEFAULT_USER_AGENT,
  };
}

/**
 * Sanitize a title for use in filenames.
 */
export function sanitizeTitle(title: string): string {
  return (
    title
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .slice(0, 50) || "video"
  );
}

/**
 * Generate a unique filename for a video.
 */
export function generateVideoFilename(title: string, videoId: string): string {
  const safeTitle = sanitizeTitle(title);
  return `${safeTitle}_${videoId}.mp4`;
}

/**
 * Get the full path for a video file in temp directory.
 */
export function getVideoPath(filename: string): string {
  return path.join(TEMP_DIR, filename);
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  "use step";
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file if it exists.
 */
export async function deleteFile(filePath: string): Promise<void> {
  "use step";
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Clean up old downloads from temp directory.
 */
export async function cleanupOldDownloads(retentionHours = 24): Promise<void> {
  "use step";
  try {
    const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
    const files = await fs.readdir(TEMP_DIR);

    for (const file of files) {
      if (!file.endsWith(".mp4")) continue;

      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < cutoff) {
          await fs.unlink(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(String(error || "❓ Unknown error"));
}
