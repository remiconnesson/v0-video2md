import { put } from "@vercel/blob"; // <--- NEW: Install this package if missing
import { AwsClient } from "aws4fetch";
import { eq } from "drizzle-orm";
import { createParser } from "eventsource-parser";
import { fetch, getWritable } from "workflow";
import { db } from "@/db";
import { videoSlideExtractions, videoSlides } from "@/db/schema";
import {
  JobStatus,
  type JobUpdate,
  type SlideData,
  type SlideStreamEvent,
  type StaticSegment,
  type VideoManifest,
  VideoManifestSchema,
} from "@/lib/slides-types";

// ============================================================================
// Config
// ============================================================================

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Default to https if no protocol specified
  return `https://${url}`;
}

const CONFIG = {
  SLIDES_EXTRACTOR_URL: normalizeUrl(getEnv("SLIDES_EXTRACTOR_URL")),
  S3_REGION: getEnv("S3_REGION", "us-east-1"),
  S3_ACCESS_KEY: getEnv("S3_ACCESS_KEY"),
  S3_SECRET_KEY: getEnv("S3_ACCESS_KEY"), // on purpose, not an issue, see the doc of our private s3 for more details
  SLIDES_API_PASSWORD: getEnv("SLIDES_API_PASSWORD"),
};

// ============================================================================
// Helper: S3 URL Handling
// ============================================================================

// NEW: aws4fetch needs a real HTTP URL, not s3://
function getS3DownloadUrl(s3Uri: string): string {
  const match = s3Uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid S3 URI: ${s3Uri}`);

  const [, bucket, key] = match;
  // Assumes path-style access for private S3: https://endpoint/bucket/key
  // Remove trailing slash from base URL if present
  const baseUrl = CONFIG.SLIDES_EXTRACTOR_URL.replace(/\/$/, "");
  return `${baseUrl}/${bucket}/${key}`;
}

// ============================================================================
// Stream Helpers
// ============================================================================

async function emitProgress(status: string, progress: number, message: string) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", status, progress, message });
  writer.releaseLock();
}

async function emitSlide(slide: SlideData) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "slide", slide });
  writer.releaseLock();
}

async function emitComplete(totalSlides: number) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", totalSlides });
  writer.releaseLock();
  await writable.close();
}

async function emitError(message: string) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", message });
  writer.releaseLock();
  await writable.close();
}

// ============================================================================
// Step: Trigger extraction on VPS
// ============================================================================

async function triggerExtraction(videoId: string): Promise<void> {
  "use step";

  // Endpoint is /process/youtube/{video_id} with Bearer auth
  const response = await fetch(
    `${CONFIG.SLIDES_EXTRACTOR_URL}/process/youtube/${videoId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger extraction: ${text}`);
  }
}

// ============================================================================
// Step: Monitor job progress via SSE
// ============================================================================

async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";

  const response = await fetch(
    `${CONFIG.SLIDES_EXTRACTOR_URL}/jobs/${videoId}/stream`,
    {
      headers: {
        Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}`,
      },
    },
  );

  if (!response.ok || !response.body) {
    throw new Error("Failed to connect to job stream");
  }

  let manifestUri: string | null = null;

  const parser = createParser({
    onEvent: async (event) => {
      if (event.event === "event" && event.data) {
        try {
          const update: JobUpdate = JSON.parse(event.data);

          // Forward progress to frontend
          await emitProgress(update.status, update.progress, update.message);

          if (update.status === JobStatus.COMPLETED && update.metadata_uri) {
            manifestUri = update.metadata_uri;
          }

          if (update.status === JobStatus.FAILED) {
            throw new Error(update.error ?? "Extraction failed");
          }
        } catch (_e) {
          // Ignore parse errors, continue streaming
        }
      }
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }

  if (!manifestUri) {
    throw new Error("Job completed but no manifest URI received");
  }

  return manifestUri;
}

// ============================================================================
// Step: Fetch manifest from S3
// ============================================================================

async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  const client = makeAwsClient();
  const httpUrl = getS3DownloadUrl(s3Uri); // <--- FIX: Convert s3:// to https://

  const response = await client.fetch(httpUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }

  const json = await response.json();
  return VideoManifestSchema.parse(json);
}

// ============================================================================
// Step: Process and save slides
// ============================================================================

async function processSlidesFromManifest(
  videoId: string,
  manifest: VideoManifest,
): Promise<number> {
  "use step";

  const videoData = manifest[videoId];
  if (!videoData) {
    throw new Error(`No data for video ${videoId} in manifest`);
  }

  // Filter to static segments only
  const staticSegments = videoData.segments.filter(
    (s): s is StaticSegment => s.kind === "static",
  );

  let slideIndex = 0;
  const client = makeAwsClient(); // <--- FIX: We need client to download images

  for (const segment of staticSegments) {
    // FIX: Access data via first_frame based on your new Schema
    const frame = segment.first_frame;

    // Skip if no frame data or missing S3 info
    if (!frame || !frame.s3_uri) continue;

    let finalImageUrl = "";

    try {
      // 1. Download image from Private S3
      const s3Url = getS3DownloadUrl(frame.s3_uri);
      const imageRes = await client.fetch(s3Url);

      if (imageRes.ok && imageRes.body) {
        // 2. Upload to Vercel Blob (Public)
        // We use the response body stream directly
        const blob = await put(
          frame.s3_key || `slide-${videoId}-${slideIndex}.jpg`,
          imageRes.body,
          {
            access: "public",
          },
        );
        finalImageUrl = blob.url;
      } else {
        console.error(`Failed to download slide image: ${s3Url}`);
      }
    } catch (e) {
      console.error("Failed to process slide image", e);
    }

    const isDuplicate = frame.duplicate_of !== null;

    // Build slide data
    const slideData: SlideData = {
      slideIndex,
      frameId: frame.frame_id,
      startTime: segment.start_time,
      endTime: segment.end_time,
      duration: segment.duration,
      s3Uri: finalImageUrl, // <--- FIX: Send the public Blob URL to frontend
      hasText: frame.has_text,
      textConfidence: Math.round(frame.text_confidence * 100),
      isDuplicate,
    };

    // Save to database
    await db
      .insert(videoSlides)
      .values({
        videoId,
        slideIndex,
        frameId: frame.frame_id,
        startTime: segment.start_time,
        endTime: segment.end_time,
        duration: segment.duration,
        s3Uri: frame.s3_uri, // Keep original ref if needed
        s3Bucket: frame.s3_bucket,
        s3Key: frame.s3_key,
        hasText: frame.has_text,
        textConfidence: Math.round(frame.text_confidence * 100),
        textBoxCount: frame.text_box_count,
        isDuplicate,
        duplicateOfSegmentId: frame.duplicate_of?.segment_id ?? null,
      })
      .onConflictDoNothing();

    // Stream to frontend
    await emitSlide(slideData);

    slideIndex++;
  }

  return slideIndex;
}

// ============================================================================
// Step: Update extraction status
// ============================================================================

async function updateExtractionStatus(
  videoId: string,
  status: "completed" | "failed",
  totalSlides?: number,
  errorMessage?: string,
) {
  "use step";

  await db
    .update(videoSlideExtractions)
    .set({
      status,
      totalSlides: totalSlides ?? null,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(videoSlideExtractions.videoId, videoId));
}

// ============================================================================
// Main Workflow
// ============================================================================

export async function extractSlidesWorkflow(videoId: string) {
  "use workflow";

  try {
    // Step 1: Trigger extraction on VPS
    await emitProgress("starting", 0, "Starting slide extraction...");
    await triggerExtraction(videoId);

    // Step 2: Monitor progress (streams to frontend)
    await emitProgress("monitoring", 10, "Processing video on server...");
    const manifestUri = await monitorJobProgress(videoId);

    // Step 3: Fetch manifest from S3
    await emitProgress("fetching", 80, "Fetching slide manifest...");
    const manifest = await fetchManifest(manifestUri);

    // Step 4: Process and save slides
    await emitProgress("saving", 90, "Saving slides to database...");
    const totalSlides = await processSlidesFromManifest(videoId, manifest);

    // Step 5: Mark complete
    await updateExtractionStatus(videoId, "completed", totalSlides);
    await emitComplete(totalSlides);

    return { success: true, totalSlides };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateExtractionStatus(videoId, "failed", undefined, message);
    await emitError(message);
    throw error;
  }
}

// ============================================================================
// Utilities
// ============================================================================

function makeAwsClient(): AwsClient {
  return new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    region: CONFIG.S3_REGION,
  });
}
