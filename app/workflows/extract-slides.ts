import { AwsClient } from "aws4fetch";
import { eq } from "drizzle-orm";
import { createParser } from "eventsource-parser";
import { fetch, getWritable, sleep } from "workflow";
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
// Config (Restored from Old Code)
// ============================================================================

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

const CONFIG = {
  SLIDES_EXTRACTOR_URL: getEnv("SLIDES_EXTRACTOR_URL"),
  // RESTORED: Specific endpoint for your private S3
  S3_BASE_URL: getEnv("S3_BASE_URL", "https://s3.remtoolz.ai"),
  S3_ACCESS_KEY: getEnv("S3_ACCESS_KEY"),
  S3_SECRET_KEY: getEnv("S3_ACCESS_KEY"), // Your specific setup
  SLIDES_API_PASSWORD: getEnv("SLIDES_API_PASSWORD"),
  // RESTORED: Needed for manual Blob upload
  BLOB_READ_WRITE_TOKEN: getEnv("BLOB_READ_WRITE_TOKEN"),
};

// ============================================================================
// Helpers
// ============================================================================

function makeAwsClient(): AwsClient {
  return new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: "s3", // Explicitly set service
    region: "us-east-1",
  });
}

// RESTORED: Your custom S3 URL parser
function parseS3Uri(s3Uri: string) {
  const urlParts = s3Uri.replace("s3://", "").split("/");
  const bucket = urlParts.shift();
  const key = urlParts.join("/");
  if (!bucket || !key) throw new Error(`Invalid S3 URI: ${s3Uri}`);
  return { bucket, key };
}

// ============================================================================
// Stream Emitters
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
// Step: Trigger extraction
// ============================================================================

async function triggerExtraction(videoId: string): Promise<void> {
  "use step";

  // Use CONFIG.SLIDES_EXTRACTOR_URL (likely https://slides-extractor.remtoolz.ai)
  const response = await fetch(
    `${CONFIG.SLIDES_EXTRACTOR_URL}/process/youtube/${videoId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger extraction: ${text}`);
  }
}

// ============================================================================
// Step: Monitor job progress (Robust with Retry)
// ============================================================================

async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";

  const MAX_TIME_MS = 20 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_TIME_MS) {
    let manifestUri: string | null = null;
    let jobFailed = false;
    let failureReason = "";

    try {
      const response = await fetch(
        `${CONFIG.SLIDES_EXTRACTOR_URL}/jobs/${videoId}/stream`,
        {
          headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
        },
      );

      if (response.status === 404) throw new Error("Job not found");

      if (response.ok && response.body) {
        const parser = createParser({
          onEvent: (event) => {
            if (event.event === "event" && event.data) {
              try {
                const update: JobUpdate = JSON.parse(event.data);

                // Capture state
                if (
                  update.status === JobStatus.COMPLETED &&
                  update.metadata_uri
                ) {
                  manifestUri = update.metadata_uri;
                }
                if (update.status === JobStatus.FAILED) {
                  jobFailed = true;
                  failureReason = update.error ?? "Extraction failed";
                }

                // Emit progress (fire and forget inside sync callback is safer in loop)
                if (!jobFailed && !manifestUri) {
                  // We don't await here to avoid blocking parser, but in WDK this is tricky.
                  // Ideally we'd buffer events. For now, we accept we might miss a progress update visually.
                  emitProgress(
                    update.status,
                    update.progress,
                    update.message,
                  ).catch(() => {});
                }
              } catch {}
            }
          },
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
          if (manifestUri || jobFailed) break;
        }
      }
    } catch (err) {
      console.warn("Stream connection dropped, retrying...", err);
    }

    if (jobFailed) throw new Error(failureReason);
    if (manifestUri) return manifestUri;

    await sleep("2s");
  }

  throw new Error("Job timed out");
}

// ============================================================================
// Step: Fetch manifest (Restored Old URL Logic)
// ============================================================================

async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  const client = makeAwsClient();
  const { bucket, key } = parseS3Uri(s3Uri);

  // RESTORED: Using your custom S3 domain
  const httpUrl = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

  const response = await client.fetch(httpUrl);
  if (!response.ok)
    throw new Error(`Failed to fetch manifest: ${response.status}`);

  const json = await response.json();
  return VideoManifestSchema.parse(json);
}

// ============================================================================
// Step: Process slides (Restored Manual Blob Upload)
// ============================================================================

async function processSlidesFromManifest(
  videoId: string,
  manifest: VideoManifest,
): Promise<number> {
  "use step";

  const videoData = manifest[videoId];
  if (!videoData) throw new Error(`No data for video ${videoId}`);

  const staticSegments = videoData.segments.filter(
    (s): s is StaticSegment => s.kind === "static",
  );

  let slideIndex = 0;
  const client = makeAwsClient();

  for (const segment of staticSegments) {
    const frame = segment.first_frame;
    if (!frame || !frame.s3_uri) continue;

    let publicImageUrl = "";

    try {
      // 1. Download from Private S3 (Custom Endpoint)
      const { bucket, key } = parseS3Uri(frame.s3_uri);
      const s3Url = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

      const imageResponse = await client.fetch(s3Url);

      if (imageResponse.ok) {
        const imageBuffer = await imageResponse.arrayBuffer();

        // 2. Upload to Vercel Blob (MANUAL FETCH - RESTORED)
        const blobPath = `slides/${videoId}/${frame.frame_id || slideIndex}.webp`;

        const blobResponse = await fetch(
          `https://blob.vercel-storage.com/${blobPath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${CONFIG.BLOB_READ_WRITE_TOKEN}`,
              "Content-Type": "image/webp",
              "x-api-version": "7",
            },
            body: imageBuffer,
          },
        );

        if (blobResponse.ok) {
          const blobResult = (await blobResponse.json()) as { url: string };
          publicImageUrl = blobResult.url;
        } else {
          console.error("Blob upload failed:", await blobResponse.text());
        }
      }
    } catch (e) {
      console.error(`Failed to process image for slide ${slideIndex}`, e);
    }

    const isDuplicate = frame.duplicate_of !== null;

    const slideData: SlideData = {
      slideIndex,
      frameId: frame.frame_id,
      startTime: segment.start_time,
      endTime: segment.end_time,
      duration: segment.duration,
      s3Uri: publicImageUrl || frame.s3_uri,
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
        imageUrl: publicImageUrl,
        s3Uri: frame.s3_uri,
        s3Bucket: frame.s3_bucket,
        s3Key: frame.s3_key,
        hasText: frame.has_text,
        textConfidence: Math.round(frame.text_confidence * 100),
        textBoxCount: frame.text_box_count,
        isDuplicate,
        duplicateOfSegmentId: frame.duplicate_of?.segment_id ?? null,
      })
      .onConflictDoNothing();

    await emitSlide(slideData);
    slideIndex++;
  }

  return slideIndex;
}

// ============================================================================
// Status Helper
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
    await emitProgress("starting", 0, "Starting slide extraction...");
    await triggerExtraction(videoId);

    await emitProgress("monitoring", 10, "Processing video on server...");
    const manifestUri = await monitorJobProgress(videoId);

    await emitProgress("fetching", 80, "Fetching slide manifest...");
    const manifest = await fetchManifest(manifestUri);

    await emitProgress("saving", 90, "Saving slides to database...");
    const totalSlides = await processSlidesFromManifest(videoId, manifest);

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
