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

  const url = `${CONFIG.SLIDES_EXTRACTOR_URL}/process/youtube/${videoId}`;

  try {
    console.log(`Triggering extraction for video ${videoId} at ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
    });

    if (!response.ok) {
      const responseText = await response.text();
      const errorDetails = {
        url,
        videoId,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseBody: responseText,
      };

      console.error("Trigger extraction failed:", errorDetails);

      throw new Error(
        `Failed to trigger extraction for video ${videoId}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    console.log(`Successfully triggered extraction for video ${videoId}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to trigger extraction")
    ) {
      throw error; // Re-throw our detailed error
    }

    console.error(
      `Network error triggering extraction for video ${videoId}:`,
      error,
    );
    throw new Error(
      `Network error triggering extraction for video ${videoId} at ${url}: ` +
        `${error instanceof Error ? error.message : "Unknown network error"}`,
    );
  }
}

// ============================================================================
// Step: Monitor job progress (Robust with Retry)
// ============================================================================

async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";

  const MAX_TIME_MS = 20 * 60 * 1000;
  const startTime = Date.now();
  const url = `${CONFIG.SLIDES_EXTRACTOR_URL}/jobs/${videoId}/stream`;
  let retryCount = 0;

  console.log(`Starting to monitor job progress for video ${videoId}`);

  while (Date.now() - startTime < MAX_TIME_MS) {
    const elapsedTime = Date.now() - startTime;
    const elapsedMinutes = Math.round((elapsedTime / 60000) * 10) / 10;

    let manifestUri: string | null = null;
    let jobFailed = false;
    let failureReason = "";

    try {
      console.log(
        `Checking job status for video ${videoId} (attempt ${++retryCount}, ${elapsedMinutes}min elapsed)`,
      );

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
      });

      if (response.status === 404) {
        console.error(`Job not found for video ${videoId} at ${url}`);
        throw new Error(
          `Job not found for video ${videoId} - may not have been created successfully`,
        );
      }

      if (!response.ok) {
        const responseText = await response.text();
        console.error(`Job status check failed for video ${videoId}:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          elapsedTime: `${elapsedMinutes} minutes`,
        });
        throw new Error(
          `Failed to check job status for video ${videoId}: ` +
            `HTTP ${response.status} ${response.statusText} - ${responseText}`,
        );
      }

      if (response.ok && response.body) {
        let eventCount = 0;
        const parser = createParser({
          onEvent: (event) => {
            if (event.event === "event" && event.data) {
              eventCount++;
              try {
                const update: JobUpdate = JSON.parse(event.data);

                console.log(`Job event ${eventCount} for video ${videoId}:`, {
                  status: update.status,
                  progress: update.progress,
                  message: update.message,
                  hasMetadataUri: !!update.metadata_uri,
                });

                // Capture state
                if (
                  update.status === JobStatus.COMPLETED &&
                  update.metadata_uri
                ) {
                  manifestUri = update.metadata_uri;
                  console.log(
                    `Job completed for video ${videoId}, manifest URI: ${manifestUri}`,
                  );
                }
                if (update.status === JobStatus.FAILED) {
                  jobFailed = true;
                  failureReason = update.error ?? "Extraction failed";
                  console.error(`Job failed for video ${videoId}:`, {
                    error: update.error,
                    fullUpdate: update,
                  });
                }

                // Emit progress (fire and forget inside sync callback is safer in loop)
                if (!jobFailed && !manifestUri) {
                  emitProgress(
                    update.status,
                    update.progress,
                    update.message,
                  ).catch(() => {});
                }
              } catch (parseError) {
                console.warn(
                  `Failed to parse job event for video ${videoId}:`,
                  parseError,
                );
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
          if (manifestUri || jobFailed) break;
        }

        console.log(
          `Stream processing complete for video ${videoId}: ${eventCount} events processed`,
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.warn(
        `Stream connection issue for video ${videoId} (attempt ${retryCount}):`,
        {
          error: errorMessage,
          elapsedTime: `${elapsedMinutes} minutes`,
          willRetry: true,
        },
      );
    }

    if (jobFailed) {
      console.error(`Job monitoring failed for video ${videoId}:`, {
        failureReason,
        elapsedTime: `${elapsedMinutes} minutes`,
        totalRetries: retryCount,
      });
      throw new Error(
        `Slide extraction job failed for video ${videoId} after ${elapsedMinutes} minutes: ${failureReason}`,
      );
    }

    if (manifestUri) {
      console.log(
        `Job monitoring completed successfully for video ${videoId}:`,
        {
          manifestUri,
          elapsedTime: `${elapsedMinutes} minutes`,
          totalRetries: retryCount,
        },
      );
      return manifestUri;
    }

    await sleep("2s");
  }

  const elapsedMinutes =
    Math.round(((Date.now() - startTime) / 60000) * 10) / 10;
  console.error(`Job monitoring timed out for video ${videoId}:`, {
    maxTimeMinutes: MAX_TIME_MS / 60000,
    elapsedTime: `${elapsedMinutes} minutes`,
    totalRetries: retryCount,
  });

  throw new Error(
    `Slide extraction job timed out for video ${videoId} after ${elapsedMinutes} minutes ` +
      `(max: ${MAX_TIME_MS / 60000} minutes, ${retryCount} status checks)`,
  );
}

// ============================================================================
// Step: Fetch manifest (Restored Old URL Logic)
// ============================================================================

async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  try {
    console.log(`Fetching manifest from S3 URI: ${s3Uri}`);

    const client = makeAwsClient();
    const { bucket, key } = parseS3Uri(s3Uri);

    // RESTORED: Using your custom S3 domain
    const httpUrl = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

    console.log(`Fetching manifest from HTTP URL: ${httpUrl}`);

    const response = await client.fetch(httpUrl);

    if (!response.ok) {
      const responseText = await response.text();
      const errorDetails = {
        s3Uri,
        httpUrl,
        bucket,
        key,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseBody: responseText,
      };

      console.error("Failed to fetch manifest:", errorDetails);

      throw new Error(
        `Failed to fetch manifest from ${httpUrl}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    const responseText = await response.text();
    console.log(
      `Manifest response received, parsing JSON (${responseText.length} chars)`,
    );

    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse manifest JSON:", {
        s3Uri,
        httpUrl,
        responseText:
          responseText.substring(0, 500) +
          (responseText.length > 500 ? "..." : ""),
        parseError:
          parseError instanceof Error ? parseError.message : parseError,
      });
      throw new Error(
        `Failed to parse manifest JSON from ${httpUrl}: ` +
          `${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }

    const manifest = VideoManifestSchema.parse(json);
    console.log(
      `Manifest parsed successfully, contains ${Object.keys(manifest).length} video entries`,
    );

    return manifest;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to fetch manifest")
    ) {
      throw error; // Re-throw our detailed error
    }

    console.error(`Unexpected error fetching manifest from ${s3Uri}:`, error);
    throw new Error(
      `Unexpected error fetching manifest from ${s3Uri}: ` +
        `${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ============================================================================
// Step: Process slides (Restored Manual Blob Upload)
// ============================================================================

async function processSlidesFromManifest(
  videoId: string,
  manifest: VideoManifest,
): Promise<number> {
  "use step";

  console.log(`Processing slides for video ${videoId}`);

  const videoData = manifest[videoId];
  if (!videoData) {
    console.error(`No data found for video ${videoId} in manifest`, {
      availableVideos: Object.keys(manifest),
      videoId,
    });
    throw new Error(
      `No data for video ${videoId} in manifest - available videos: ${Object.keys(manifest).join(", ")}`,
    );
  }

  const staticSegments = videoData.segments.filter(
    (s): s is StaticSegment => s.kind === "static",
  );

  console.log(
    `Found ${staticSegments.length} static segments for video ${videoId}`,
  );

  let slideIndex = 0;
  let successfulSlides = 0;
  let failedSlides = 0;
  const client = makeAwsClient();

  for (const segment of staticSegments) {
    const frame = segment.first_frame;
    if (!frame || !frame.s3_uri) {
      console.warn(
        `Skipping segment ${slideIndex} for video ${videoId}: missing frame or S3 URI`,
        {
          segment,
          hasFrame: !!frame,
          hasS3Uri: frame ? !!frame.s3_uri : false,
        },
      );
      slideIndex++;
      continue;
    }

    let publicImageUrl = "";
    let imageProcessingError: string | null = null;

    try {
      console.log(
        `Processing slide ${slideIndex} for video ${videoId} (frame: ${frame.frame_id})`,
      );

      // 1. Download from Private S3 (Custom Endpoint)
      const { bucket, key } = parseS3Uri(frame.s3_uri);
      const s3Url = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

      console.log(`Downloading image from S3: ${s3Url}`);

      const imageResponse = await client.fetch(s3Url);

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        imageProcessingError = `S3 download failed: HTTP ${imageResponse.status} ${imageResponse.statusText} - ${errorText}`;
        console.error(`Failed to download image for slide ${slideIndex}:`, {
          videoId,
          slideIndex,
          frameId: frame.frame_id,
          s3Url,
          status: imageResponse.status,
          statusText: imageResponse.statusText,
          responseBody: errorText,
        });
      } else {
        const imageBuffer = await imageResponse.arrayBuffer();
        console.log(
          `Downloaded image (${imageBuffer.byteLength} bytes), uploading to Vercel Blob`,
        );

        // 2. Upload to Vercel Blob (MANUAL FETCH - RESTORED)
        const blobPath = `slides/${videoId}/${frame.frame_id || slideIndex}.webp`;
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
          imageProcessingError = `Blob upload failed: HTTP ${blobResponse.status} ${blobResponse.statusText} - ${blobErrorText}`;
          console.error(
            `Failed to upload image to blob for slide ${slideIndex}:`,
            {
              videoId,
              slideIndex,
              frameId: frame.frame_id,
              blobUrl,
              status: blobResponse.status,
              statusText: blobResponse.statusText,
              responseBody: blobErrorText,
            },
          );
        } else {
          const blobResult = (await blobResponse.json()) as { url: string };
          publicImageUrl = blobResult.url;
          console.log(`Successfully uploaded image to blob: ${publicImageUrl}`);
        }
      }
    } catch (e) {
      imageProcessingError = `Unexpected error processing image: ${e instanceof Error ? e.message : "Unknown error"}`;
      console.error(
        `Unexpected error processing image for slide ${slideIndex}:`,
        {
          videoId,
          slideIndex,
          frameId: frame.frame_id,
          error:
            e instanceof Error
              ? {
                  name: e.name,
                  message: e.message,
                  stack: e.stack,
                }
              : e,
        },
      );
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
      imageProcessingError,
    };

    // Save to database
    try {
      console.log(`Saving slide ${slideIndex} to database`);
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

      console.log(`Successfully saved slide ${slideIndex} to database`);
      successfulSlides++;
    } catch (dbError) {
      failedSlides++;
      const dbErrorMessage = `Database save failed: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`;
      console.error(`Failed to save slide ${slideIndex} to database:`, {
        videoId,
        slideIndex,
        frameId: frame.frame_id,
        error:
          dbError instanceof Error
            ? {
                name: dbError.name,
                message: dbError.message,
                stack: dbError.stack,
              }
            : dbError,
      });

      // Continue processing other slides even if DB save fails
      // But emit the slide with error info
      slideData.s3Uri = frame.s3_uri; // Use original S3 URI since blob upload failed
      slideData.dbError = dbErrorMessage;
    }

    await emitSlide(slideData);
    slideIndex++;
  }

  console.log(`Slide processing completed for video ${videoId}:`, {
    totalSegments: staticSegments.length,
    successfulSlides,
    failedSlides,
    successRate: `${Math.round((successfulSlides / staticSegments.length) * 100)}%`,
  });

  if (failedSlides > 0) {
    console.warn(
      `${failedSlides} slides failed to process for video ${videoId}, but ${successfulSlides} succeeded`,
    );
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

  try {
    console.log(`Updating extraction status for video ${videoId}:`, {
      status,
      totalSlides,
      hasErrorMessage: !!errorMessage,
    });

    const result = await db
      .update(videoSlideExtractions)
      .set({
        status,
        totalSlides: totalSlides ?? null,
        errorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(videoSlideExtractions.videoId, videoId));

    console.log(`Successfully updated extraction status for video ${videoId}`);
    return result;
  } catch (error) {
    console.error(`Failed to update extraction status for video ${videoId}:`, {
      videoId,
      status,
      totalSlides,
      errorMessage,
      dbError:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    });

    // Don't throw here - we don't want status update failures to crash the workflow
    // But log it prominently since this is critical for monitoring
    console.error(
      `CRITICAL: Could not update extraction status for video ${videoId} - manual intervention may be required`,
    );
  }
}

// ============================================================================
// Main Workflow
// ============================================================================

export async function extractSlidesWorkflow(videoId: string) {
  "use workflow";

  let currentStep = "initialization";

  try {
    currentStep = "triggering extraction";
    await emitProgress("starting", 0, "Starting slide extraction...");
    await triggerExtraction(videoId);

    currentStep = "monitoring job progress";
    await emitProgress("monitoring", 10, "Processing video on server...");
    const manifestUri = await monitorJobProgress(videoId);

    currentStep = "fetching manifest";
    await emitProgress("fetching", 80, "Fetching slide manifest...");
    const manifest = await fetchManifest(manifestUri);

    currentStep = "processing slides";
    await emitProgress("saving", 90, "Saving slides to database...");
    const totalSlides = await processSlidesFromManifest(videoId, manifest);

    currentStep = "updating status";
    await updateExtractionStatus(videoId, "completed", totalSlides);
    await emitComplete(totalSlides);

    return { success: true, totalSlides };
  } catch (error) {
    console.error(`Extract slides workflow failed at step: ${currentStep}`, {
      videoId,
      step: currentStep,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      timestamp: new Date().toISOString(),
    });

    const detailedMessage =
      error instanceof Error
        ? `Step "${currentStep}" failed: ${error.message}`
        : `Step "${currentStep}" failed: Unknown error occurred`;

    try {
      await updateExtractionStatus(
        videoId,
        "failed",
        undefined,
        detailedMessage,
      );
    } catch (statusError) {
      console.error("Failed to update extraction status:", statusError);
    }

    await emitError(detailedMessage);
    throw error;
  }
}
