import type { Payload as YtDlpPayload } from "youtube-dl-exec";
import {
  saveTranscriptToDb,
  type TranscriptResult,
  type TranscriptSegment,
} from "@/db/save-transcript";

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

  // Pattern for timestamp line: "00:00:00.000 --> 00:00:03.000" (VTT) or "00:00:00,000 --> 00:00:03,000" (SRT)
  const timestampPattern =
    /^(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})/;

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
          timestampPattern.test(textLine) ||
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
// Step: Fetch from YouTube using yt-dlp with Zyte proxy
// ============================================================================

export async function fetchYoutubeTranscriptFromYtDlp(
  videoId: string,
): Promise<TranscriptResult> {
  "use step";

  const youtubeDlExec = await import("youtube-dl-exec");
  const ytDlp = youtubeDlExec.default;

  // Build proxy URL from environment variables
  const zyteApiKey = process.env.ZYTE_API_KEY;
  const zyteHost = process.env.ZYTE_HOST;

  if (!zyteApiKey || !zyteHost) {
    throw new Error(
      "ZYTE_API_KEY and ZYTE_HOST environment variables are required",
    );
  }

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
    noCheckCertificates: true,
    forceIpv4: true,
  });

  // When using dumpSingleJson, the result is a Payload object, not a string
  if (typeof result === "string") {
    throw new Error(`Unexpected string response from yt-dlp: ${result}`);
  }
  const metadata: YtDlpPayload = result;

  console.log(`[yt-dlp] Got metadata for: ${metadata.title}`);

  // Determine the best subtitle source
  // Prefer manual subtitles over auto-generated
  // biome-ignore lint/suspicious/noExplicitAny: yt-dlp returns untyped objects for subtitles
  const subtitles: Record<string, any[]> = metadata.subtitles ?? {};
  // biome-ignore lint/suspicious/noExplicitAny: yt-dlp returns untyped objects for auto-captions
  const autoCaptions: Record<string, any[]> = metadata.automatic_captions ?? {};

  const hasManualSubs = Object.keys(subtitles).length > 0;
  const hasAutoCaptions = Object.keys(autoCaptions).length > 0;
  const subsSource = hasManualSubs ? subtitles : autoCaptions;

  // Prefer English, fall back to first available language
  const languages = Object.keys(subsSource);
  const preferredLang =
    languages.find((l) => l.startsWith("en")) ?? languages[0];

  let segments: TranscriptSegment[] = [];
  let isAutoGenerated = !hasManualSubs && hasAutoCaptions;

  if (preferredLang && subsSource[preferredLang]) {
    const subtitleFormats = subsSource[preferredLang];
    // Prefer vtt format, then srt, then any available
    const preferredFormat =
      subtitleFormats.find(
        // biome-ignore lint/suspicious/noExplicitAny: yt-dlp returns untyped format objects
        (f: any) => f.ext === "vtt" || f.ext === "vtt3",
      ) ??
      // biome-ignore lint/suspicious/noExplicitAny: yt-dlp returns untyped format objects
      subtitleFormats.find((f: any) => f.ext === "srt") ??
      subtitleFormats[0];

    if (preferredFormat?.url) {
      console.log(
        `[yt-dlp] Fetching ${isAutoGenerated ? "auto-generated" : "manual"} subtitles (${preferredLang}, ${preferredFormat.ext})`,
      );

      // Fetch the subtitle file using the proxy
      const subtitleResponse = await fetch(preferredFormat.url, {
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

  // If no subtitles found, we need to check if this is acceptable
  // For now, return empty transcript but log a warning
  if (segments.length === 0) {
    console.warn(
      `[yt-dlp] Warning: No transcript segments extracted for video: ${videoId}`,
    );
    // Depending on requirements, we might want to throw here instead
    isAutoGenerated = false;
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
// Step: Save to database
// ============================================================================

export async function saveYoutubeTranscriptToDb(
  transcriptData: TranscriptResult,
) {
  "use step";

  await saveTranscriptToDb(transcriptData);
}
