/*
 * Workaround for https://github.com/vercel/workflow/issues/618 where `await run.returnValue` hangs infinitely in production when using Vercel workflow with RSC.

Moved the fetch-and-save-transcript logic from the workflow directly into a lib utility function that can be called synchronously from RSC.

Tried to reuse the workflow steps directly but stumbled upon another issue https://github.com/vercel/workflow/issues/630, where you can't call a step function outside of a workflow if that functions uses dependencies not marked with "use step"
*/

import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Payload as YtDlpPayload } from "youtube-dl-exec";
import { z } from "zod";
import { getVideoWithTranscript } from "@/db/queries";
import {
  saveTranscriptToDb,
  type TranscriptResult,
  type TranscriptSegment,
} from "@/db/save-transcript";
import { formatTranscriptForLLM } from "@/lib/transcript-format";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";

// ============================================================================
// Transcript Schema (for validation)
// ============================================================================

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

function validateTranscriptStructure(data: unknown): TranscriptSegment[] {
  return z.array(TranscriptSegmentSchema).parse(data);
}

// ============================================================================
// Transcript Data Interface
// ============================================================================

export interface TranscriptData {
  videoId: string;
  title: string;
  channelName: string;
  description: string | null;
  transcript: string;
}

// ============================================================================
// Zod schema for validating yt-dlp subtitle format entries
// ============================================================================

const SubtitleFormatSchema = z.object({
  ext: z.string(),
  url: z.string(),
  name: z.string().optional(),
});

const SubtitleMapSchema = z.record(z.string(), z.array(SubtitleFormatSchema));

const YtDlpSubtitlesSchema = z.object({
  subtitles: SubtitleMapSchema.optional().default({}),
  automatic_captions: SubtitleMapSchema.optional().default({}),
});

// ============================================================================
// yt-dlp Helpers
// ============================================================================

const YT_DLP_DOWNLOAD_BASE_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function formatDurationFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Parse VTT timestamp to seconds (e.g., "00:01:23.456" -> 83.456)
function parseVttTimestamp(timestamp: string): number {
  const parts = timestamp.split(":");
  if (parts.length === 3) {
    const [hours, minutes, secondsMs] = parts;
    const [seconds, ms] = (secondsMs ?? "0").split(".");
    return (
      Number.parseInt(hours ?? "0", 10) * 3600 +
      Number.parseInt(minutes ?? "0", 10) * 60 +
      Number.parseInt(seconds ?? "0", 10) +
      Number.parseInt((ms ?? "0").padEnd(3, "0").slice(0, 3), 10) / 1000
    );
  }
  if (parts.length === 2) {
    const [minutes, secondsMs] = parts;
    const [seconds, ms] = (secondsMs ?? "0").split(".");
    return (
      Number.parseInt(minutes ?? "0", 10) * 60 +
      Number.parseInt(seconds ?? "0", 10) +
      Number.parseInt((ms ?? "0").padEnd(3, "0").slice(0, 3), 10) / 1000
    );
  }
  return 0;
}

function getYtDlpBinaryName(): string {
  if (process.env.YOUTUBE_DL_FILENAME?.trim()) {
    return process.env.YOUTUBE_DL_FILENAME.trim();
  }

  return process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
}

function getYtDlpBinaryPath(): string {
  if (process.env.YOUTUBE_DL_PATH?.trim()) {
    return process.env.YOUTUBE_DL_PATH.trim();
  }

  const binaryDir =
    process.env.YOUTUBE_DL_DIR?.trim() ??
    path.join(os.tmpdir(), "video2md-yt-dlp");

  return path.join(binaryDir, getYtDlpBinaryName());
}

async function ensureYtDlpBinary(): Promise<string> {
  const binaryPath = getYtDlpBinaryPath();

  try {
    await access(binaryPath);
    return binaryPath;
  } catch {
    const binaryDir = path.dirname(binaryPath);
    await mkdir(binaryDir, { recursive: true });

    const downloadUrl = `${YT_DLP_DOWNLOAD_BASE_URL}/${getYtDlpBinaryName()}`;
    console.log(`[yt-dlp] Downloading yt-dlp binary from: ${downloadUrl}`);

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(
        `[yt-dlp] Failed to download yt-dlp binary: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(binaryPath, buffer);

    if (process.platform !== "win32") {
      await chmod(binaryPath, 0o755);
    }

    return binaryPath;
  }
}

// Parse VTT/SRT subtitle text into TranscriptSegment[]
function parseSubtitlesToSegments(subtitleText: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = subtitleText.split("\n");

  // Skip WEBVTT header if present
  let i = 0;
  if (lines[0]?.startsWith("WEBVTT")) {
    i = 1;
    // Skip any header metadata until we hit a blank line
    while (i < lines.length && lines[i]?.trim() !== "") {
      i++;
    }
  }

  // Timestamp pattern that also allows trailing VTT cue settings
  // (e.g., "00:00:00.000 --> 00:00:03.000 align:start position:0%")
  const timestampPattern =
    /^(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})(?:\s.*)?$/;

  while (i < lines.length) {
    const line = lines[i]?.trim() ?? "";

    // Skip empty lines and cue identifiers (SRT numbers or VTT cue IDs)
    if (line === "" || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    const match = line.match(timestampPattern);
    if (match?.[1] && match[2]) {
      // Normalize comma to period for SRT format
      const start = parseVttTimestamp(match[1].replace(",", "."));
      const end = parseVttTimestamp(match[2].replace(",", "."));

      // Collect text lines until we hit an empty line or another timestamp
      const textLines: string[] = [];
      i++;
      while (i < lines.length) {
        const textLine = lines[i] ?? "";
        if (
          textLine.trim() === "" ||
          timestampPattern.test(textLine.trim()) ||
          /^\d+$/.test(textLine.trim())
        ) {
          break;
        }
        // Remove VTT tags like <c>, </c>, <00:00:00.000>, etc.
        const cleanedLine = textLine
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .trim();
        if (cleanedLine) {
          textLines.push(cleanedLine);
        }
        i++;
      }

      if (textLines.length > 0) {
        segments.push({
          start,
          end,
          text: textLines.join(" "),
        });
      }
    } else {
      i++;
    }
  }

  return segments;
}

// ============================================================================
// DB Functions
// ============================================================================

async function getTranscriptDataFromDb(
  videoId: string,
): Promise<TranscriptData | null> {
  const transcriptRow = await getVideoWithTranscript(videoId);

  if (!transcriptRow) {
    return null;
  }

  const transcriptSegments = validateTranscriptStructure(
    transcriptRow.transcript,
  );

  return {
    ...transcriptRow,
    transcript: formatTranscriptForLLM(transcriptSegments),
  };
}

// ============================================================================
// yt-dlp Functions
// ============================================================================

async function fetchYoutubeTranscriptFromYtDlp(
  videoId: string,
): Promise<TranscriptResult> {
  if (!isValidYouTubeVideoId(videoId)) {
    throw new Error(`Invalid YouTube video ID format: ${videoId}`);
  }

  const youtubeDlExec = await import("youtube-dl-exec");
  const ytDlpBinaryPath = await ensureYtDlpBinary();
  const create =
    "create" in youtubeDlExec && typeof youtubeDlExec.create === "function"
      ? youtubeDlExec.create
      : youtubeDlExec.default.create;

  if (typeof create !== "function") {
    throw new Error("[yt-dlp] Failed to initialize yt-dlp binary wrapper.");
  }

  const ytDlp = create(ytDlpBinaryPath);

  // Build proxy URL from environment variables
  const zyteApiKey = process.env.ZYTE_API_KEY;
  const zyteHost = process.env.ZYTE_HOST;

  if (!zyteApiKey || !zyteHost) {
    throw new Error(
      "ZYTE_API_KEY and ZYTE_HOST environment variables are required",
    );
  }

  const disableTlsVerify = process.env.YTDLP_INSECURE === "true";
  const proxyUrl = `http://${zyteApiKey.trim()}:@${zyteHost}:8011`;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  console.log(`[yt-dlp] Fetching metadata for video: ${videoId}`);

  // Fetch video metadata and subtitle info using yt-dlp
  const result = await ytDlp(videoUrl, {
    dumpSingleJson: true,
    noWarnings: true,
    skipDownload: true,
    proxy: proxyUrl,
    noCacheDir: true,
    noCheckCertificates: disableTlsVerify,
    forceIpv4: true,
  });

  // When using dumpSingleJson, the result is a Payload object, not a string
  if (typeof result === "string") {
    throw new Error(`Unexpected string response from yt-dlp: ${result}`);
  }
  const metadata: YtDlpPayload = result;

  console.log(`[yt-dlp] Got metadata for: ${metadata.title}`);

  // Validate subtitle-related fields with Zod
  const subtitleData = YtDlpSubtitlesSchema.parse({
    subtitles: metadata.subtitles,
    automatic_captions: metadata.automatic_captions,
  });

  const { subtitles, automatic_captions: autoCaptions } = subtitleData;

  const hasManualSubs = Object.keys(subtitles).length > 0;
  const hasAutoCaptions = Object.keys(autoCaptions).length > 0;
  const subsSource = hasManualSubs ? subtitles : autoCaptions;

  // Prefer English, fall back to first available language
  const languages = Object.keys(subsSource);
  const preferredLang =
    languages.find((l) => l.startsWith("en")) ?? languages[0];

  let segments: TranscriptSegment[] = [];
  const isAutoGenerated = !hasManualSubs && hasAutoCaptions;

  if (preferredLang && subsSource[preferredLang]) {
    const subtitleFormats = subsSource[preferredLang];
    // Prefer vtt format, then srt, then any available
    const preferredFormat =
      subtitleFormats.find((f) => f.ext === "vtt" || f.ext === "vtt3") ??
      subtitleFormats.find((f) => f.ext === "srt") ??
      subtitleFormats[0];

    if (preferredFormat?.url) {
      console.log(
        `[yt-dlp] Fetching ${isAutoGenerated ? "auto-generated" : "manual"} subtitles (${preferredLang}, ${preferredFormat.ext})`,
      );

      // Fetch subtitle file through the Zyte proxy
      const { ProxyAgent, fetch: undiFetch } = await import("undici");
      const proxyAgent = new ProxyAgent(proxyUrl);
      const subtitleResponse = await undiFetch(preferredFormat.url, {
        dispatcher: proxyAgent,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (subtitleResponse.ok) {
        const subtitleText = await subtitleResponse.text();
        segments = parseSubtitlesToSegments(subtitleText);
        console.log(`[yt-dlp] Parsed ${segments.length} subtitle segments`);
      } else {
        console.warn(
          `[yt-dlp] Failed to fetch subtitles: ${subtitleResponse.status}`,
        );
      }
    }
  } else {
    console.warn(`[yt-dlp] No subtitles available for video: ${videoId}`);
  }

  if (segments.length === 0) {
    throw new Error(
      `No transcript segments could be extracted for video: ${videoId}`,
    );
  }

  // Extract upload date in expected format (YYYY-MM-DD or as available)
  let publishedDate = "";
  if (metadata.upload_date) {
    // yt-dlp returns date as YYYYMMDD, convert to YYYY-MM-DD
    const d = String(metadata.upload_date);
    if (d.length === 8) {
      publishedDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    } else {
      publishedDate = d;
    }
  }

  return {
    videoId,
    url: String(metadata.webpage_url ?? videoUrl),
    title: String(metadata.title ?? "Untitled"),
    date: publishedDate,
    channelId: String(metadata.channel_id ?? metadata.uploader_id ?? ""),
    channelName: String(
      metadata.channel ?? metadata.uploader ?? "Unknown Channel",
    ),
    description: metadata.description ? String(metadata.description) : "",
    numberOfSubscribers: 0, // yt-dlp doesn't reliably provide subscriber count
    viewCount: Number(metadata.view_count ?? 0),
    likes: Number(metadata.like_count ?? 0),
    duration: formatDurationFromSeconds(Number(metadata.duration ?? 0)),
    isAutoGenerated,
    thumbnailUrl: String(metadata.thumbnail ?? ""),
    transcript: segments,
  };
}

// ============================================================================
// Main Function: Fetch and Save Transcript
// ============================================================================

/**
 * Fetches transcript data for a YouTube video.
 * First checks the database for cached data, if not found fetches via yt-dlp and saves.
 *
 * This is a direct implementation that doesn't use the Vercel workflow system,
 * working around the issue where `await run.returnValue` hangs in production RSC.
 * See: https://github.com/vercel/workflow/issues/618
 */
export async function fetchAndSaveTranscript(
  videoId: string,
): Promise<TranscriptData> {
  console.log("[fetchAndSaveTranscript] 1. Start, videoId:", videoId);

  const cachedTranscriptData = await getTranscriptDataFromDb(videoId);
  console.log("[fetchAndSaveTranscript] 2. Cached:", !!cachedTranscriptData);

  if (cachedTranscriptData?.title && cachedTranscriptData.channelName) {
    return cachedTranscriptData;
  }

  if (cachedTranscriptData) {
    console.log(
      "[fetchAndSaveTranscript] Cached data found but incomplete (missing title or channel). Re-fetching...",
    );
  }

  console.log("[fetchAndSaveTranscript] 3. Fetching via yt-dlp...");
  const fetchedResult = await fetchYoutubeTranscriptFromYtDlp(videoId);
  console.log("[fetchAndSaveTranscript] 4. Saving to DB...");
  await saveTranscriptToDb(fetchedResult);

  // biome-ignore lint/style/noNonNullAssertion: we know the transcript data exists after saving
  const transcriptData = (await getTranscriptDataFromDb(videoId))!;

  console.log("[fetchAndSaveTranscript] 5. Returning:", transcriptData.title);
  return transcriptData;
}
