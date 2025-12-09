import { db } from "@/db";
import { videoSlides } from "@/db/schema";
import {
  type FrameMetadata,
  type SlideData,
  type StaticSegment,
  type VideoManifest,
  VideoManifestSchema,
} from "@/lib/slides-types";
import { CONFIG, makeAwsClient, parseS3Uri } from "./config";

// ============================================================================
// Step: Fetch manifest (Restored Old URL Logic)
// ============================================================================

export async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
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
          firstFrameDuplicateOfFramePosition:
            firstFrame?.duplicate_of?.frame_position ?? null,
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
          lastFrameDuplicateOfFramePosition:
            lastFrame?.duplicate_of?.frame_position ?? null,
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

    // Import emitSlide dynamically to avoid circular dependency
    const { emitSlide } = await import("./stream-emitters");
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
