/*
 * Workaround for https://github.com/vercel/workflow/issues/618 where `await run.returnValue` hangs infinitely in production when using Vercel workflow with RSC.

Moved the fetch-and-save-transcript logic from the workflow directly into a lib utility function that can be called synchronously from RSC.

Tried to reuse the workflow steps directly but stumbled upon another issue https://github.com/vercel/workflow/issues/630, where you can't call a step function outside of a workflow if that functions uses dependencies not marked with "use step"
*/
import ytdl from "@distube/ytdl-core";
import { ProxyAgent, fetch as undiciFetch } from "undici";
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
// ytdl-core Helpers
// ============================================================================

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
// ytdl-core Functions
// ============================================================================

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
};

function buildProxyUrl(): string | null {
  const zyteApiKey = process.env.ZYTE_API_KEY;
  const zyteHost = process.env.ZYTE_HOST;

  if (!zyteApiKey || !zyteHost) {
    return null;
  }

  return `http://${zyteApiKey.trim()}:@${zyteHost}:8011`;
}

function buildSubtitleUrl(baseUrl: string): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}fmt=vtt`;
}

function selectCaptionTrack(captionTracks: CaptionTrack[]): CaptionTrack | null {
  if (captionTracks.length === 0) {
    return null;
  }

  const manualTracks = captionTracks.filter((track) => track.kind !== "asr");
  const autoTracks = captionTracks.filter((track) => track.kind === "asr");
  const tracks = manualTracks.length > 0 ? manualTracks : autoTracks;

  return (
    tracks.find((track) =>
      (track.languageCode ?? "").toLowerCase().startsWith("en"),
    ) ?? tracks[0] ?? null
  );
}

async function fetchSubtitleText(
  subtitleUrl: string,
  proxyUrl: string | null,
): Promise<string> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  };

  if (proxyUrl) {
    const proxyAgent = new ProxyAgent(proxyUrl);
    const response = await undiciFetch(subtitleUrl, {
      dispatcher: proxyAgent,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch subtitles via proxy: ${response.status}`,
      );
    }

    return await response.text();
  }

  const response = await fetch(subtitleUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch subtitles: ${response.status}`);
  }

  return await response.text();
}

async function fetchYoutubeTranscriptFromYtdlCore(
  videoId: string,
): Promise<TranscriptResult> {
  if (!isValidYouTubeVideoId(videoId)) {
    throw new Error(`Invalid YouTube video ID format: ${videoId}`);
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const proxyUrl = buildProxyUrl();
  const agent = proxyUrl ? ytdl.createProxyAgent(proxyUrl) : undefined;

  console.log(`[ytdl-core] Fetching metadata for video: ${videoId}`);

  const info = await ytdl.getInfo(videoUrl, agent ? { agent } : undefined);

  console.log(`[ytdl-core] Got metadata for: ${info.videoDetails.title}`);

  const captionTracks =
    info.player_response?.captions?.playerCaptionsTracklistRenderer
      ?.captionTracks ?? [];
  const selectedTrack = selectCaptionTrack(captionTracks);

  if (!selectedTrack) {
    throw new Error(`No captions available for video: ${videoId}`);
  }

  const isAutoGenerated = selectedTrack.kind === "asr";
  const subtitleUrl = buildSubtitleUrl(selectedTrack.baseUrl);

  console.log(
    `[ytdl-core] Fetching ${isAutoGenerated ? "auto-generated" : "manual"} subtitles (${selectedTrack.languageCode ?? "unknown"})`,
  );

  const subtitleText = await fetchSubtitleText(subtitleUrl, proxyUrl);
  const segments = parseSubtitlesToSegments(subtitleText);

  console.log(`[ytdl-core] Parsed ${segments.length} subtitle segments`);

  if (segments.length === 0) {
    throw new Error(
      `No transcript segments could be extracted for video: ${videoId}`,
    );
  }

  const videoDetails = info.videoDetails;
  const author =
    typeof videoDetails.author === "string" ? null : videoDetails.author;

  const thumbnails = videoDetails.thumbnails ?? [];
  const thumbnailUrl = thumbnails[thumbnails.length - 1]?.url ?? "";

  return {
    videoId,
    url: String(videoDetails.video_url ?? videoUrl),
    title: String(videoDetails.title ?? "Untitled"),
    date: videoDetails.publishDate ?? videoDetails.uploadDate ?? "",
    channelId: String(author?.id ?? videoDetails.channelId ?? ""),
    channelName: String(
      author?.name ?? videoDetails.author ?? "Unknown Channel",
    ),
    description: videoDetails.description ?? "",
    numberOfSubscribers: Number(author?.subscriber_count ?? 0),
    viewCount: Number(videoDetails.viewCount ?? 0),
    likes: Number(videoDetails.likes ?? 0),
    duration: formatDurationFromSeconds(Number(videoDetails.lengthSeconds ?? 0)),
    isAutoGenerated,
    thumbnailUrl,
    transcript: segments,
  };
}

// ============================================================================
// Main Function: Fetch and Save Transcript
// ============================================================================

/**
 * Fetches transcript data for a YouTube video.
 * First checks the database for cached data, if not found fetches via ytdl-core and saves.
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

  console.log("[fetchAndSaveTranscript] 3. Fetching via ytdl-core...");
  const fetchedResult = await fetchYoutubeTranscriptFromYtdlCore(videoId);
  console.log("[fetchAndSaveTranscript] 4. Saving to DB...");
  await saveTranscriptToDb(fetchedResult);

  // biome-ignore lint/style/noNonNullAssertion: we know the transcript data exists after saving
  const transcriptData = (await getTranscriptDataFromDb(videoId))!;

  console.log("[fetchAndSaveTranscript] 5. Returning:", transcriptData.title);
  return transcriptData;
}
