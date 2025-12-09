import { AwsClient } from "aws4fetch";
import { eq } from "drizzle-orm";
import { createParser } from "eventsource-parser";
import { FatalError, fetch, getWritable } from "workflow";
import { db } from "@/db";
import { videoSlideExtractions, videoSlides } from "@/db/schema";
import {
  type FrameMetadata,
  JobStatus,
  type JobUpdate,
  type SlideData,
  type SlideStreamEvent,
  type StaticSegment,
  type VideoManifest,
  VideoManifestSchema,
} from "@/lib/slides-types";

// Re-export event type for consumers
export type { SlideStreamEvent };

// ============================================================================
// Config
// ============================================================================

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

const CONFIG = {
  SLIDES_EXTRACTOR_URL: getEnv("SLIDES_EXTRACTOR_URL"),
  S3_BASE_URL: getEnv("S3_BASE_URL", "https://s3.remtoolz.ai"),
  S3_ACCESS_KEY: getEnv("S3_ACCESS_KEY"),
  S3_SECRET_KEY: getEnv("S3_SECRET_KEY"),
  SLIDES_API_PASSWORD: getEnv("SLIDES_API_PASSWORD"),
  BLOB_READ_WRITE_TOKEN: getEnv("BLOB_READ_WRITE_TOKEN"),
};

function makeAwsClient(): AwsClient {
  return new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: "s3",
    region: "us-east-1",
  });
}

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

export async function emitProgress(
  status: string,
  progress: number,
  message: string,
) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", status, progress, message });
  writer.releaseLock();
}

export async function emitSlide(slide: SlideData) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "slide", slide });
  writer.releaseLock();
}

export async function emitComplete(totalSlides: number) {
  "use step";
  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", totalSlides });
  writer.releaseLock();
  await writable.close();
}

export async function emitError(message: string) {
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

export async function triggerExtraction(videoId: string): Promise<void> {
  "use step";

  const url = `${CONFIG.SLIDES_EXTRACTOR_URL}/process/youtube/${videoId}`;

  try {
    console.log(
      `📤 triggerExtraction: Triggering extraction for video ${videoId} at ${url}`,
    );

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error("Trigger extraction failed:", {
        url,
        videoId,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
      });

      throw new Error(
        `Failed to trigger extraction for video ${videoId}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    console.log(
      `📤 triggerExtraction: Successfully triggered extraction for video ${videoId}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to trigger extraction")
    ) {
      throw error;
    }

    console.error(
      `📤 triggerExtraction: Network error triggering extraction for video ${videoId}:`,
      error,
    );
    throw new Error(
      `Network error triggering extraction for video ${videoId} at ${url}: ` +
        `${error instanceof Error ? error.message : "Unknown network error"}`,
    );
  }
}

// ============================================================================
// Step: Monitor job progress
// ============================================================================

async function checkJobStatus(videoId: string): Promise<{
  manifestUri: string | null;
  jobFailed: boolean;
  failureReason: string;
}> {
  "use step";

  const url = `${CONFIG.SLIDES_EXTRACTOR_URL}/jobs/${videoId}/stream`;
  let manifestUri: string | null = null;
  let jobFailed = false;
  let failureReason = "";

  console.log(`🔍 checkJobStatus: Checking job status for video ${videoId}`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
  });

  if (response.status === 404) {
    console.error(`🔍 checkJobStatus: Job not found for video ${videoId}`);
    throw new FatalError(
      `Job not found for video ${videoId} - job may not have been created successfully.`,
    );
  }

  if (!response.ok) {
    const responseText = await response.text();
    const isClientError = response.status >= 400 && response.status < 500;
    const ErrorClass = isClientError ? FatalError : Error;

    throw new ErrorClass(
      `Failed to check job status for video ${videoId}: ` +
        `HTTP ${response.status} ${response.statusText} | ` +
        `Response: ${responseText.substring(0, 100)}`,
    );
  }

  if (response.body) {
    const parser = createParser({
      onEvent: (event) => {
        if (event.data) {
          try {
            const update: JobUpdate = JSON.parse(event.data);

            console.log(`🔍️ checkJobStatus: Job event for video ${videoId}:`, {
              status: update.status,
              progress: update.progress,
              message: update.message,
              hasMetadataUri: !!update.metadata_uri,
            });

            if (update.status === JobStatus.COMPLETED && update.metadata_uri) {
              manifestUri = update.metadata_uri;
            }
            if (update.status === JobStatus.FAILED) {
              jobFailed = true;
              failureReason = update.error ?? "Extraction failed";
            }

            // Emit progress for non-terminal states
            if (!jobFailed && !manifestUri) {
              emitProgress(
                update.status,
                update.progress,
                update.message,
              ).catch((e) => console.warn("Failed to emit progress:", e));
            }
          } catch {
            // Ignore parse errors
          }
        }
      },
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value));
      if (manifestUri || jobFailed) break;
    }
  }

  return { manifestUri, jobFailed, failureReason };
}

checkJobStatus.maxRetries = 1;

export async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";
  const result = await checkJobStatus(videoId);
  if (result.manifestUri) {
    return result.manifestUri;
  }
  throw new FatalError(
    `No manifest URI found: ${JSON.stringify(result, null, 2)}`,
  );
}

// ============================================================================
// Step: Fetch manifest
// ============================================================================

export async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  try {
    console.log(`📥 fetchManifest: Fetching manifest from S3 URI: ${s3Uri}`);

    const client = makeAwsClient();
    const { bucket, key } = parseS3Uri(s3Uri);
    const httpUrl = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

    const response = await client.fetch(httpUrl);

    if (!response.ok) {
      const responseText = await response.text();
      console.error("📥 fetchManifest: Failed to fetch manifest:", {
        s3Uri,
        httpUrl,
        status: response.status,
        responseBody: responseText,
      });

      throw new Error(
        `Failed to fetch manifest from ${httpUrl}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    const responseText = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(
        `Failed to parse manifest JSON from ${httpUrl}: ` +
          `${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }

    const manifest = VideoManifestSchema.parse(json);
    console.log(
      `📥 fetchManifest: Manifest parsed successfully, contains ${Object.keys(manifest).length} video entries`,
    );

    return manifest;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to fetch manifest")
    ) {
      throw error;
    }

    throw new Error(
      `Unexpected error fetching manifest from ${s3Uri}: ` +
        `${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ============================================================================
// Step: Process slides from manifest
// ============================================================================

export async function processSlidesFromManifest(
  videoId: string,
  manifest: VideoManifest,
): Promise<number> {
  "use step";

  console.log(
    `💾 processSlidesFromManifest: Processing slides for video ${videoId}`,
  );

  const videoData = manifest[videoId];
  if (!videoData) {
    throw new Error(
      `No data for video ${videoId} in manifest - available videos: ${Object.keys(manifest).join(", ")}`,
    );
  }

  const staticSegments = videoData.segments.filter(
    (s): s is StaticSegment => s.kind === "static",
  );

  console.log(
    `💾 processSlidesFromManifest: Found ${staticSegments.length} static segments`,
  );

  let slideIndex = 0;
  let successfulSlides = 0;
  let failedSlides = 0;
  const client = makeAwsClient();

  for (const segment of staticSegments) {
    const firstFrame = segment.first_frame;
    const lastFrame = segment.last_frame;

    if (
      (!firstFrame || !firstFrame.s3_uri) &&
      (!lastFrame || !lastFrame.s3_uri)
    ) {
      console.warn(
        `💾 processSlidesFromManifest: Skipping segment ${slideIndex}: missing frames`,
      );
      slideIndex++;
      continue;
    }

    let firstFrameImageUrl = "";
    let lastFrameImageUrl = "";
    let imageProcessingError: string | null = null;

    async function processFrame(
      frame: FrameMetadata,
      frameType: "first" | "last",
    ): Promise<string> {
      if (!frame.s3_uri) {
        throw new Error(`${frameType} frame missing S3 URI`);
      }
      const { bucket, key } = parseS3Uri(frame.s3_uri);
      const s3Url = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

      const imageResponse = await client.fetch(s3Url);
      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        throw new Error(
          `S3 download failed: HTTP ${imageResponse.status} - ${errorText}`,
        );
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      const blobPath = `slides/${videoId}/${frame.frame_id || `${slideIndex}-${frameType}`}.webp`;
      const blobUrl = `https://blob.vercel-storage.com/${blobPath}`;

      const blobResponse = await fetch(blobUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${CONFIG.BLOB_READ_WRITE_TOKEN}`,
          "Content-Type": "image/webp",
          "x-api-version": "7",
        },
        body: imageBuffer,
      });

      if (!blobResponse.ok) {
        const blobErrorText = await blobResponse.text();
        throw new Error(
          `Blob upload failed: HTTP ${blobResponse.status} - ${blobErrorText}`,
        );
      }

      const blobResult = (await blobResponse.json()) as { url: string };
      return blobResult.url;
    }

    if (firstFrame?.s3_uri) {
      try {
        firstFrameImageUrl = await processFrame(firstFrame, "first");
      } catch (e) {
        imageProcessingError =
          (imageProcessingError ? `${imageProcessingError}; ` : "") +
          (e instanceof Error ? e.message : "Unknown error");
      }
    }

    if (lastFrame?.s3_uri) {
      try {
        lastFrameImageUrl = await processFrame(lastFrame, "last");
      } catch (e) {
        imageProcessingError =
          (imageProcessingError ? `${imageProcessingError}; ` : "") +
          (e instanceof Error ? e.message : "Unknown error");
      }
    }

    const slideData: SlideData = {
      slideIndex,
      frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
      startTime: segment.start_time,
      endTime: segment.end_time,
      duration: segment.duration,
      firstFrameImageUrl: firstFrameImageUrl || null,
      firstFrameHasText: firstFrame?.has_text || false,
      firstFrameTextConfidence: firstFrame
        ? Math.round(firstFrame.text_confidence * 100)
        : 0,
      firstFrameIsDuplicate: firstFrame?.duplicate_of !== null,
      firstFrameDuplicateOfSegmentId:
        firstFrame?.duplicate_of?.segment_id ?? null,
      firstFrameDuplicateOfFramePosition:
        firstFrame?.duplicate_of?.frame_position ?? null,
      firstFrameSkipReason: firstFrame?.skip_reason ?? null,
      lastFrameImageUrl: lastFrameImageUrl || null,
      lastFrameHasText: lastFrame?.has_text || false,
      lastFrameTextConfidence: lastFrame
        ? Math.round(lastFrame.text_confidence * 100)
        : 0,
      lastFrameIsDuplicate: lastFrame?.duplicate_of !== null,
      lastFrameDuplicateOfSegmentId:
        lastFrame?.duplicate_of?.segment_id ?? null,
      lastFrameDuplicateOfFramePosition:
        lastFrame?.duplicate_of?.frame_position ?? null,
      lastFrameSkipReason: lastFrame?.skip_reason ?? null,
      imageProcessingError,
    };

    try {
      await db
        .insert(videoSlides)
        .values({
          videoId,
          slideIndex,
          frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
          startTime: segment.start_time,
          endTime: segment.end_time,
          duration: segment.duration,
          firstFrameS3Uri: firstFrame?.s3_uri || null,
          firstFrameS3Bucket: firstFrame?.s3_bucket || null,
          firstFrameS3Key: firstFrame?.s3_key || null,
          firstFrameImageUrl: firstFrameImageUrl || null,
          firstFrameHasText: firstFrame?.has_text || false,
          firstFrameTextConfidence: firstFrame
            ? Math.round(firstFrame.text_confidence * 100)
            : null,
          firstFrameTextBoxCount: firstFrame?.text_box_count || null,
          firstFrameIsDuplicate: firstFrame?.duplicate_of !== null,
          firstFrameDuplicateOfSegmentId:
            firstFrame?.duplicate_of?.segment_id ?? null,
          firstFrameDuplicateOfFramePosition:
            firstFrame?.duplicate_of?.frame_position ?? null,
          firstFrameSkipReason: firstFrame?.skip_reason ?? null,
          lastFrameS3Uri: lastFrame?.s3_uri || null,
          lastFrameS3Bucket: lastFrame?.s3_bucket || null,
          lastFrameS3Key: lastFrame?.s3_key || null,
          lastFrameImageUrl: lastFrameImageUrl || null,
          lastFrameHasText: lastFrame?.has_text || false,
          lastFrameTextConfidence: lastFrame
            ? Math.round(lastFrame.text_confidence * 100)
            : null,
          lastFrameTextBoxCount: lastFrame?.text_box_count || null,
          lastFrameIsDuplicate: lastFrame?.duplicate_of !== null,
          lastFrameDuplicateOfSegmentId:
            lastFrame?.duplicate_of?.segment_id ?? null,
          lastFrameDuplicateOfFramePosition:
            lastFrame?.duplicate_of?.frame_position ?? null,
          lastFrameSkipReason: lastFrame?.skip_reason ?? null,
        })
        .onConflictDoNothing();

      successfulSlides++;
    } catch (dbError) {
      failedSlides++;
      const dbErrorMessage = `Database save failed: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`;
      console.error(
        `💾 processSlidesFromManifest: Failed to save slide ${slideIndex}:`,
        dbError,
      );
      slideData.firstFrameImageUrl = null;
      slideData.lastFrameImageUrl = null;
      slideData.dbError = dbErrorMessage;
    }

    await emitSlide(slideData);
    slideIndex++;
  }

  console.log(
    `💾 processSlidesFromManifest: Completed - ${successfulSlides} successful, ${failedSlides} failed`,
  );

  return successfulSlides;
}

// ============================================================================
// Step: Update extraction status
// ============================================================================

export async function updateExtractionStatus(
  videoId: string,
  status: "completed" | "failed",
  totalSlides?: number,
  errorMessage?: string,
) {
  "use step";

  try {
    await db
      .update(videoSlideExtractions)
      .set({
        status,
        totalSlides: totalSlides ?? null,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(videoSlideExtractions.videoId, videoId));

    console.log(
      `📊 updateExtractionStatus: Updated status for video ${videoId} to ${status}`,
    );
  } catch (error) {
    console.error(
      `📊 updateExtractionStatus: Failed to update status for video ${videoId}:`,
      error,
    );
  }
}
