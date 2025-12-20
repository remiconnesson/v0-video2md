import { db } from "@/db";
import { videoSlides } from "@/db/schema";
import {
  type SlideData,
  type VideoManifest,
  VideoManifestSchema,
} from "@/lib/slides-types";
import {
  extractSlideTimings,
  filterStaticSegments,
  hasUsableFrames,
  normalizeFrameMetadata,
} from "./manifest-processing.utils";

// ============================================================================
// Step: Fetch manifest (Restored Old URL Logic)
// ============================================================================

export async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  try {
    console.log(`📥 fetchManifest: Fetching manifest from S3 URI: ${s3Uri}`);

    const client = makeAwsClient();
    const parsedS3Uri = parseS3Uri(s3Uri);

    if (!parsedS3Uri) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    const { bucket, key } = parsedS3Uri;

    // RESTORED: Using your custom S3 domain
    const httpUrl = buildS3HttpUrl(CONFIG.S3_BASE_URL, bucket, key);

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

  const staticSegments = filterStaticSegments(videoData.segments);

  console.log(
    `💾 processSlidesFromManifest: Found ${staticSegments.length} static segments for video ${videoId}`,
  );

  let slideIndex = 1; // ⚠️ Start at 1 since backend is using 1-based indexing for slides, TODO: unforce it by test
  let successfulSlides = 0;
  let failedSlides = 0;

  for (const segment of staticSegments) {
    const firstFrame = segment.first_frame;
    const lastFrame = segment.last_frame;

    // Skip if no frames available
    if (!hasUsableFrames(segment)) {
      console.warn(
        `💾 processSlidesFromManifest: Skipping segment ${slideIndex} for video ${videoId}: missing frames`,
        {
          segment,
          hasFirstFrame: !!firstFrame,
          hasLastFrame: !!lastFrame,
        },
      );
      slideIndex++;
      continue;
    }

    const firstFrameImageUrl = null;
    const lastFrameImageUrl = null;
    const imageProcessingError: string | null = null;

    const timings = extractSlideTimings(segment);
    const firstFrameData = normalizeFrameMetadata(
      firstFrame,
      firstFrameImageUrl,
    );
    const lastFrameData = normalizeFrameMetadata(lastFrame, lastFrameImageUrl);

    const slideData: SlideData = {
      slideIndex,
      frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
      ...timings,
      firstFrameImageUrl: firstFrameData.imageUrl,
      firstFrameIsDuplicate: firstFrameData.isDuplicate,
      firstFrameDuplicateOfSegmentId: firstFrameData.duplicateOfSegmentId,
      firstFrameDuplicateOfFramePosition:
        firstFrameData.duplicateOfFramePosition as "first" | "last" | null,
      firstFrameSkipReason: firstFrameData.skipReason,
      lastFrameImageUrl: lastFrameData.imageUrl,
      lastFrameIsDuplicate: lastFrameData.isDuplicate,
      lastFrameDuplicateOfSegmentId: lastFrameData.duplicateOfSegmentId,
      lastFrameDuplicateOfFramePosition:
        lastFrameData.duplicateOfFramePosition as "first" | "last" | null,
      lastFrameSkipReason: lastFrameData.skipReason,
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
          firstFrameImageUrl: firstFrameImageUrl || null,
          firstFrameIsDuplicate: firstFrame?.duplicate_of !== null,
          firstFrameDuplicateOfSegmentId:
            firstFrame?.duplicate_of?.segment_id ?? null,
          firstFrameDuplicateOfFramePosition:
            firstFrame?.duplicate_of?.frame_position ?? null,
          firstFrameSkipReason: firstFrame?.skip_reason ?? null,

          // Last frame data
          lastFrameImageUrl: lastFrameImageUrl || null,
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
