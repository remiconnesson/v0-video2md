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
    console.log(
      `📤 triggerExtraction: Triggering extraction for video ${videoId} at ${url}`,
    );

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

    console.log(
      `📤 triggerExtraction: Successfully triggered extraction for video ${videoId}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to trigger extraction")
    ) {
      throw error; // Re-throw our detailed error
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
// Step: Check job status (single attempt)
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
    console.error(`🔍 checkJobStatus: Job not found for video ${videoId}`, {
      videoId,
      url,
      status: response.status,
      statusText: response.statusText,
      errorType: "JOB_NOT_FOUND",
      timestamp: new Date().toISOString(),
    });
    throw new FatalError(
      `Job not found for video ${videoId} - job may not have been created successfully. ` +
        `URL: ${url} | Status: ${response.status}`,
    );
  }

  if (!response.ok) {
    const responseText = await response.text();
    const isServerError = response.status >= 500;
    const isClientError = response.status >= 400 && response.status < 500;

    console.error(
      `🔍 checkJobStatus: Job status check failed for video ${videoId}`,
      {
        videoId,
        url,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 200), // Truncate long responses
        errorType: isServerError
          ? "SERVER_ERROR"
          : isClientError
            ? "CLIENT_ERROR"
            : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
      },
    );

    // Use FatalError for client errors (4xx) as they won't be fixed by retries
    const ErrorClass = isClientError ? FatalError : Error;

    throw new ErrorClass(
      `Failed to check job status for video ${videoId}: ` +
        `HTTP ${response.status} ${response.statusText} | ` +
        `Response: ${responseText.substring(0, 100)}... | ` +
        `URL: ${url}`,
    );
  }

  if (response.ok && response.body) {
    let eventCount = 0;
    const parser = createParser({
      onEvent: (event) => {
        console.dir(event);
        if (event.data) {
          eventCount++;
          try {
            const update: JobUpdate = JSON.parse(event.data);

            console.dir(update, { depth: null });

            console.log(
              `🔍️ checkJobStatus: Job event ${eventCount} for video ${videoId}:`,
              {
                status: update.status,
                progress: update.progress,
                message: update.message,
                hasMetadataUri: !!update.metadata_uri,
                metadataUri: update.metadata_uri,
              },
            );

            // Capture state
            if (update.status === JobStatus.COMPLETED && update.metadata_uri) {
              manifestUri = update.metadata_uri;
              console.log(
                `🔍 checkJobStatus: Job completed for video ${videoId}, manifest URI: ${manifestUri}`,
              );
            }
            if (update.status === JobStatus.FAILED) {
              jobFailed = true;
              failureReason = update.error ?? "Extraction failed";
              console.error(
                `🔍 checkJobStatus: Job failed for video ${videoId}:`,
                {
                  error: update.error,
                  fullUpdate: update,
                },
              );
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
              `🔍 checkJobStatus: Failed to parse job event for video ${videoId}:`,
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
      parser.feed(decoder.decode(value));
      if (manifestUri || jobFailed) break;
    }

    console.log(
      `🔍 checkJobStatus: Stream processing complete for video ${videoId}: ${eventCount} events processed`,
    );
  }

  return { manifestUri, jobFailed, failureReason };
}

checkJobStatus.maxRetries = 1;

// ============================================================================
// Workflow: Monitor job progress (Fast Failure with Detailed Info)
// ============================================================================

async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";
  const result = await checkJobStatus(videoId);
  if (result.manifestUri) {
    return result.manifestUri;
  } else {
    throw new FatalError(
      `no manifest uri found: ${JSON.stringify(result, null, 2)}`,
    );
  }
}

// ============================================================================
// Step: Fetch manifest (Restored Old URL Logic)
// ============================================================================

async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  try {
    console.log(`📥 fetchManifest: Fetching manifest from S3 URI: ${s3Uri}`);

    const client = makeAwsClient();
    const { bucket, key } = parseS3Uri(s3Uri);

    // RESTORED: Using your custom S3 domain
    const httpUrl = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

    console.log(
      `📥 fetchManifest: Fetching manifest from HTTP URL: ${httpUrl}`,
    );

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

      console.error(
        "📥 fetchManifest: Failed to fetch manifest:",
        errorDetails,
      );

      throw new Error(
        `Failed to fetch manifest from ${httpUrl}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    const responseText = await response.text();
    console.log(
      `📥 fetchManifest: Manifest response received, parsing JSON (${responseText.length} chars)`,
    );

    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error("📥 fetchManifest: Failed to parse manifest JSON:", {
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
      `📥 fetchManifest: Manifest parsed successfully, contains ${Object.keys(manifest).length} video entries`,
    );

    return manifest;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to fetch manifest")
    ) {
      throw error; // Re-throw our detailed error
    }

    console.error(
      `📥 fetchManifest: Unexpected error fetching manifest from ${s3Uri}:`,
      error,
    );
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

  console.log(
    `💾 processSlidesFromManifest: Processing slides for video ${videoId}`,
  );

  const videoData = manifest[videoId];
  if (!videoData) {
    console.error(
      `💾 processSlidesFromManifest: No data found for video ${videoId} in manifest`,
      {
        availableVideos: Object.keys(manifest),
        videoId,
      },
    );
    throw new Error(
      `No data for video ${videoId} in manifest - available videos: ${Object.keys(manifest).join(", ")}`,
    );
  }

  const staticSegments = videoData.segments.filter(
    (s): s is StaticSegment => s.kind === "static",
  );

  console.log(
    `💾 processSlidesFromManifest: Found ${staticSegments.length} static segments for video ${videoId}`,
  );

  let slideIndex = 0;
  let successfulSlides = 0;
  let failedSlides = 0;
  const client = makeAwsClient();

  for (const segment of staticSegments) {
    const firstFrame = segment.first_frame;
    const lastFrame = segment.last_frame;

    // Skip if no frames available
    if (
      (!firstFrame || !firstFrame.s3_uri) &&
      (!lastFrame || !lastFrame.s3_uri)
    ) {
      console.warn(
        `💾 processSlidesFromManifest: Skipping segment ${slideIndex} for video ${videoId}: missing frames or S3 URIs`,
        {
          segment,
          hasFirstFrame: !!firstFrame,
          hasFirstS3Uri: firstFrame ? !!firstFrame.s3_uri : false,
          hasLastFrame: !!lastFrame,
          hasLastS3Uri: lastFrame ? !!lastFrame.s3_uri : false,
        },
      );
      slideIndex++;
      continue;
    }

    let firstFrameImageUrl = "";
    let lastFrameImageUrl = "";
    let imageProcessingError: string | null = null;

    // Helper function to process a single frame
    async function processFrame(
      frame: FrameMetadata,
      frameType: "first" | "last",
    ): Promise<string> {
      try {
        console.log(
          `💾 processSlidesFromManifest: Processing ${frameType} frame for slide ${slideIndex} (frame: ${frame.frame_id})`,
        );

        // 1. Download from Private S3 (Custom Endpoint)
        if (!frame.s3_uri) {
          throw new Error(`${frameType} frame missing S3 URI`);
        }
        const { bucket, key } = parseS3Uri(frame.s3_uri);
        const s3Url = `${CONFIG.S3_BASE_URL}/${bucket}/${key}`;

        console.log(
          `💾 processSlidesFromManifest: Downloading ${frameType} frame image from S3: ${s3Url}`,
        );

        const imageResponse = await client.fetch(s3Url);

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          throw new Error(
            `S3 download failed: HTTP ${imageResponse.status} ${imageResponse.statusText} - ${errorText}`,
          );
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        console.log(
          `💾 processSlidesFromManifest: Downloaded ${frameType} frame image (${imageBuffer.byteLength} bytes), uploading to Vercel Blob`,
        );

        // 2. Upload to Vercel Blob (MANUAL FETCH - RESTORED)
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
            `Blob upload failed: HTTP ${blobResponse.status} ${blobResponse.statusText} - ${blobErrorText}`,
          );
        }

        const blobResult = (await blobResponse.json()) as { url: string };
        const publicImageUrl = blobResult.url;
        console.log(
          `💾 processSlidesFromManifest: Successfully uploaded ${frameType} frame image to blob: ${publicImageUrl}`,
        );

        return publicImageUrl;
      } catch (e) {
        throw new Error(
          `${frameType} frame processing failed: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      }
    }

    // Process first frame
    if (firstFrame?.s3_uri) {
      try {
        firstFrameImageUrl = await processFrame(firstFrame, "first");
      } catch (e) {
        console.error(
          `💾 processSlidesFromManifest: Failed to process first frame for slide ${slideIndex}:`,
          e,
        );
        imageProcessingError =
          (imageProcessingError ? `${imageProcessingError}; ` : "") +
          (e instanceof Error ? e.message : "Unknown error");
      }
    }

    // Process last frame
    if (lastFrame?.s3_uri) {
      try {
        lastFrameImageUrl = await processFrame(lastFrame, "last");
      } catch (e) {
        console.error(
          `💾 processSlidesFromManifest: Failed to process last frame for slide ${slideIndex}:`,
          e,
        );
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
      firstFrameSkipReason: firstFrame?.skip_reason ?? null,
      lastFrameImageUrl: lastFrameImageUrl || null,
      lastFrameHasText: lastFrame?.has_text || false,
      lastFrameTextConfidence: lastFrame
        ? Math.round(lastFrame.text_confidence * 100)
        : 0,
      lastFrameIsDuplicate: lastFrame?.duplicate_of !== null,
      lastFrameDuplicateOfSegmentId:
        lastFrame?.duplicate_of?.segment_id ?? null,
      lastFrameSkipReason: lastFrame?.skip_reason ?? null,
      imageProcessingError,
    };

    // Save to database
    try {
      console.log(
        `💾 processSlidesFromManifest: Saving slide ${slideIndex} to database`,
      );
      await db
        .insert(videoSlides)
        .values({
          videoId,
          slideIndex,
          frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
          startTime: segment.start_time,
          endTime: segment.end_time,
          duration: segment.duration,

          // First frame data
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
          firstFrameSkipReason: firstFrame?.skip_reason ?? null,

          // Last frame data
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
          lastFrameSkipReason: lastFrame?.skip_reason ?? null,
        })
        .onConflictDoNothing();

      console.log(
        `💾 processSlidesFromManifest: Successfully saved slide ${slideIndex} to database`,
      );
      successfulSlides++;
    } catch (dbError) {
      failedSlides++;
      const dbErrorMessage = `Database save failed: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`;
      console.error(
        `💾 processSlidesFromManifest: Failed to save slide ${slideIndex} to database:`,
        {
          videoId,
          slideIndex,
          frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
          error:
            dbError instanceof Error
              ? {
                  name: dbError.name,
                  message: dbError.message,
                  stack: dbError.stack,
                }
              : dbError,
        },
      );

      // Continue processing other slides even if DB save fails
      // But emit the slide with error info
      slideData.firstFrameImageUrl = null;
      slideData.lastFrameImageUrl = null;
      slideData.dbError = dbErrorMessage;
    }

    await emitSlide(slideData);
    slideIndex++;
  }

  console.log(
    `💾 processSlidesFromManifest: Slide processing completed for video ${videoId}:`,
    {
      totalSegments: staticSegments.length,
      successfulSlides,
      failedSlides,
      successRate: `${Math.round((successfulSlides / staticSegments.length) * 100)}%`,
    },
  );

  if (failedSlides > 0) {
    console.warn(
      `💾 processSlidesFromManifest: ${failedSlides} slides failed to process for video ${videoId}, but ${successfulSlides} succeeded`,
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
    console.log(
      `📊 updateExtractionStatus: Updating extraction status for video ${videoId}:`,
      {
        status,
        totalSlides,
        hasErrorMessage: !!errorMessage,
      },
    );

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
      `📊 updateExtractionStatus: Successfully updated extraction status for video ${videoId}`,
    );
    return;
  } catch (error) {
    console.error(
      `📊 updateExtractionStatus: Failed to update extraction status for video ${videoId}:`,
      {
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
      },
    );

    // Don't throw here - we don't want status update failures to crash the workflow
    // But log it prominently since this is critical for monitoring
    console.error(
      `📊 updateExtractionStatus: CRITICAL: Could not update extraction status for video ${videoId} - manual intervention may be required`,
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
    console.error(
      `🚀 extractSlidesWorkflow: Extract slides workflow failed at step: ${currentStep}`,
      {
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
      },
    );

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
      console.error(
        "🚀 extractSlidesWorkflow: Failed to update extraction status:",
        statusError,
      );
    }

    await emitError(detailedMessage);
    throw error;
  }
}
