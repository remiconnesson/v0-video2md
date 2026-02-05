import { Client, ProxyAgent, fetch as undiFetch } from "undici";
import { Innertube } from "youtubei.js";
import {
  saveTranscriptToDb,
  type TranscriptResult,
  type TranscriptSegment,
} from "@/db/save-transcript";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";

// ============================================================================
// Helpers
// ============================================================================

// Convert seconds to duration string (e.g., "50:20" or "1:23:45")
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
// Step: Fetch from YouTube using youtubei.js
// ============================================================================

export async function fetchYoutubeTranscriptFromYoutubei(
  videoId: string,
): Promise<TranscriptResult> {
  "use step";

  if (!isValidYouTubeVideoId(videoId)) {
    throw new Error(`Invalid YouTube video ID format: ${videoId}`);
  }

  // Build proxy configuration from environment variables
  const zyteApiKey = process.env.ZYTE_API_KEY;
  const zyteHost = process.env.ZYTE_HOST;

  if (!zyteApiKey || !zyteHost) {
    throw new Error(
      "ZYTE_API_KEY and ZYTE_HOST environment variables are required",
    );
  }

  const disableTlsVerify = process.env.YTDLP_INSECURE === "true";

  const proxyAgent = new ProxyAgent({
    uri: `http://${zyteHost}:8011`,
    token: `Basic ${Buffer.from(`${zyteApiKey.trim()}:`).toString("base64")}`,
    // factory is used to create the Client for the target origin (e.g. youtube.com)
    factory: (origin, opts) => {
      return new Client(origin, {
        ...opts,
        connect: disableTlsVerify ? { rejectUnauthorized: false } : undefined,
      });
    },
  });

  console.log(`[youtubei.js] Fetching metadata for video: ${videoId}`);

  // If TLS verification is disabled, set the global Node.js flag as a last resort
  // to ensure all internal library calls respect it.
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (disableTlsVerify) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  // Create Innertube instance with custom fetch to use Zyte proxy
  const yt = await Innertube.create({
    fetch: (async (input: any, init: any) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const fetchInit = { ...init };
      if (!fetchInit.method && input?.method) fetchInit.method = input.method;
      if (!fetchInit.body && input?.body) fetchInit.body = input.body;

      // Request with GET/HEAD method cannot have body
      if (fetchInit.method === "GET" || fetchInit.method === "HEAD") {
        delete fetchInit.body;
      }

      return undiFetch(url, {
        ...fetchInit,
        dispatcher: proxyAgent,
        connect: disableTlsVerify ? { rejectUnauthorized: false } : undefined,
      } as any);
    }) as any,
  });

  const info = await yt.getInfo(videoId);

  // Restore TLS verification flag
  if (disableTlsVerify) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
  }
  const { basic_info } = info;

  console.log(`[youtubei.js] Got metadata for: ${basic_info.title}`);

  let segments: TranscriptSegment[] = [];
  let isAutoGenerated = false;

  // Try to get transcript
  if (
    info.captions?.caption_tracks &&
    info.captions.caption_tracks.length > 0
  ) {
    const captionTracks = info.captions.caption_tracks;

    // Prefer English (manual), then English (auto), then any manual, then any auto
    const preferredTrack =
      captionTracks.find((t) => t.language_code === "en" && !t.kind) ||
      captionTracks.find((t) => t.language_code === "en") ||
      captionTracks.find((t) => !t.kind) ||
      captionTracks[0];

    if (preferredTrack) {
      isAutoGenerated = preferredTrack.kind === "asr";
      console.log(
        `[youtubei.js] Fetching ${isAutoGenerated ? "auto-generated" : "manual"} subtitles (${preferredTrack.language_code})`,
      );

      const subtitleUrl = `${preferredTrack.base_url}&fmt=vtt`;

      if (disableTlsVerify) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      }

      const subtitleResponse = await undiFetch(subtitleUrl, {
        dispatcher: proxyAgent,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        connect: disableTlsVerify ? { rejectUnauthorized: false } : undefined,
      } as any);

      if (disableTlsVerify) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      }

      if (subtitleResponse.ok) {
        const subtitleText = await subtitleResponse.text();
        segments = parseSubtitlesToSegments(subtitleText);
        console.log(
          `[youtubei.js] Parsed ${segments.length} subtitle segments`,
        );
      } else {
        console.warn(
          `[youtubei.js] Failed to fetch subtitles: ${subtitleResponse.status}`,
        );
      }
    }
  }

  if (segments.length === 0) {
    // Fallback to getTranscript if manual fetch failed or no tracks found
    try {
      console.log("[youtubei.js] Trying info.getTranscript() fallback...");
      const transcript = (await info.getTranscript()) as any;
      if (
        transcript?.transcript_tracks &&
        transcript.transcript_tracks.length > 0
      ) {
        // Note: If we had mapped transcript segments from getTranscript, we'd do it here.
      }
    } catch (_e) {
      console.warn("[youtubei.js] Fallback getTranscript() also failed");
    }
  }

  if (segments.length === 0) {
    throw new Error(
      `No transcript segments could be extracted for video: ${videoId}`,
    );
  }

  // Extract upload date
  let publishedDate = "";
  if (basic_info.start_timestamp) {
    publishedDate =
      new Date(basic_info.start_timestamp).toISOString().split("T")[0] ?? "";
  } else if ((info as any).primary_info?.published?.text) {
    publishedDate = (info as any).primary_info.published.text.toString();
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: basic_info.title ?? "Untitled",
    date: publishedDate,
    channelId: basic_info.channel_id ?? "",
    channelName: basic_info.author ?? "Unknown Channel",
    description: basic_info.short_description ?? "",
    numberOfSubscribers: 0, // youtubei.js might have it in secondary_info but it's complex to extract reliably
    viewCount: basic_info.view_count ?? 0,
    likes: basic_info.like_count ?? 0,
    duration: formatDurationFromSeconds(basic_info.duration ?? 0),
    isAutoGenerated,
    thumbnailUrl: basic_info.thumbnail?.[0]?.url ?? "",
    transcript: segments,
  };
}

// ============================================================================
// Step: Save to database
// ============================================================================

export async function saveYoutubeTranscriptToDb(
  transcriptData: TranscriptResult,
) {
  "use step";

  await saveTranscriptToDb(transcriptData);
}
