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
  normalizeFrameMetadata,
} from "./manifest-processing.utils";

// ============================================================================
// Step: Fetch manifest (Restored Old URL Logic)
// ============================================================================

function getBlobStorageRootUrl(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const storeId = token.split("_")[3];
  const storageRootUrl = `https://${storeId}.public.blob.vercel-storage.com`;
  return storageRootUrl;
}

function getManifestBlobUrl(videoId: string): string {
  const storageRootUrl = getBlobStorageRootUrl();
  return `${storageRootUrl}/manifests/${videoId}.json`;
}

export async function fetchManifest(videoId: string): Promise<VideoManifest> {
  "use step";
  const json = await fetch(getManifestBlobUrl(videoId)).then((res) =>
    res.json(),
  );

  const manifest = VideoManifestSchema.parse(json);

  return manifest;
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

  let slideNumber = 1;
  let successfulSlides = 0;
  let failedSlides = 0;

  for (const segment of staticSegments) {
    const firstFrame = segment.first_frame;
    const lastFrame = segment.last_frame;

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
      slideNumber,
      frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
      ...timings,
      firstFrameImageUrl: firstFrameData.imageUrl,
      firstFrameIsDuplicate: firstFrameData.isDuplicate,
      firstFrameDuplicateOfSlideNumber: firstFrameData.duplicateOfSlideNumber,
      firstFrameDuplicateOfFramePosition:
        firstFrameData.duplicateOfFramePosition as "first" | "last" | null,
      lastFrameImageUrl: lastFrameData.imageUrl,
      lastFrameIsDuplicate: lastFrameData.isDuplicate,
      lastFrameDuplicateOfSlideNumber: lastFrameData.duplicateOfSlideNumber,
      lastFrameDuplicateOfFramePosition:
        lastFrameData.duplicateOfFramePosition as "first" | "last" | null,
      imageProcessingError,
    };

    // Save to database
    try {
      console.log(
        `💾 processSlidesFromManifest: Saving slide ${slideNumber} to database`,
      );
      const dbSlideData = {
        videoId,
        slideNumber,
        frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
        startTime: segment.start_time,
        endTime: segment.end_time,
        duration: segment.duration,

        // First frame data
        firstFrameImageUrl: firstFrameImageUrl || null,
        firstFrameIsDuplicate: firstFrame?.duplicate_of !== null,
        firstFrameDuplicateOfSlideNumber:
          firstFrame?.duplicate_of?.segment_id ?? null,
        firstFrameDuplicateOfFramePosition:
          (firstFrame?.duplicate_of?.frame_position as "first" | "last") ??
          null,

        // Last frame data
        lastFrameImageUrl: lastFrameImageUrl || null,
        lastFrameIsDuplicate: lastFrame?.duplicate_of !== null,
        lastFrameDuplicateOfSlideNumber:
          lastFrame?.duplicate_of?.segment_id ?? null,
        lastFrameDuplicateOfFramePosition:
          (lastFrame?.duplicate_of?.frame_position as "first" | "last") ?? null,
      };

      await db.insert(videoSlides).values(dbSlideData).onConflictDoNothing();

      console.log(
        `💾 processSlidesFromManifest: Successfully saved slide ${slideNumber} to database`,
      );
      successfulSlides++;
    } catch (dbError) {
      failedSlides++;
      const dbErrorMessage = `Database save failed: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`;
      console.error(
        `💾 processSlidesFromManifest: Failed to save slide ${slideNumber} to database:`,
        {
          videoId,
          slideNumber,
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
    slideNumber++;
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

  return slideNumber;
}
