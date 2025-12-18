/**
 * Local video processing step using yt-service utilities.
 * Replaces the external VPS API calls with local processing.
 */

import { db } from "@/db";
import { videoSlides } from "@/db/schema";
import type { SlideData } from "@/lib/slides-types";
import {
  type ProcessingResult,
  processYouTubeVideo,
} from "@/yt-service/process-video";
import type { Segment, StaticSegment } from "@/yt-service/types";

// ============================================================================
// Step: Process video locally
// ============================================================================

export async function processVideoLocally(
  videoId: string,
  onProgress?: (stage: string, progress: number, message: string) => void,
): Promise<ProcessingResult> {
  "use step";

  console.log(
    `🎬 processVideoLocally: Starting local processing for video ${videoId}`,
  );

  const result = await processYouTubeVideo(
    videoId,
    (stage, progress, message) => {
      console.log(
        `🎬 processVideoLocally: [${stage}] ${progress.toFixed(1)}% - ${message}`,
      );
      onProgress?.(stage, progress, message);
    },
  );

  console.log(
    `🎬 processVideoLocally: Completed processing for video ${videoId}`,
    {
      totalFrames: result.totalFrames,
      totalSegments: result.segments.length,
      videoDuration: result.videoDuration,
    },
  );

  return result;
}

// ============================================================================
// Step: Save slides to database
// ============================================================================

export async function saveSlidesToDatabase(
  videoId: string,
  segments: Segment[],
): Promise<{ savedSlides: SlideData[]; totalSlides: number }> {
  "use step";

  console.log(`💾 saveSlidesToDatabase: Saving slides for video ${videoId}`);

  const savedSlides: SlideData[] = [];
  let slideIndex = 0;

  for (const segment of segments) {
    if (segment.kind !== "static") continue;

    const staticSegment = segment as StaticSegment;
    const firstFrame = staticSegment.firstFrame;
    const lastFrame = staticSegment.lastFrame;

    // Skip if no frames available
    if (!firstFrame && !lastFrame) {
      console.warn(
        `💾 saveSlidesToDatabase: Skipping segment ${slideIndex} for video ${videoId}: no frames`,
      );
      slideIndex++;
      continue;
    }

    const slideData: SlideData = {
      slideIndex,
      frameId: firstFrame?.frameId || lastFrame?.frameId || null,
      startTime: staticSegment.startTime,
      endTime: staticSegment.endTime,
      duration: staticSegment.duration,

      // First frame data
      firstFrameImageUrl: firstFrame?.url || null,
      firstFramePhash: firstFrame?.phash || null,
      firstFrameIsDuplicate: firstFrame?.duplicateOf !== null,
      firstFrameDuplicateOfSegmentId:
        firstFrame?.duplicateOf?.segmentId ?? null,
      firstFrameDuplicateOfFramePosition:
        firstFrame?.duplicateOf?.framePosition ?? null,
      firstFrameSkipReason: firstFrame?.skipReason ?? null,

      // Last frame data
      lastFrameImageUrl: lastFrame?.url || null,
      lastFramePhash: lastFrame?.phash || null,
      lastFrameIsDuplicate: lastFrame?.duplicateOf !== null,
      lastFrameDuplicateOfSegmentId: lastFrame?.duplicateOf?.segmentId ?? null,
      lastFrameDuplicateOfFramePosition:
        lastFrame?.duplicateOf?.framePosition ?? null,
      lastFrameSkipReason: lastFrame?.skipReason ?? null,
    };

    try {
      await db
        .insert(videoSlides)
        .values({
          videoId,
          slideIndex,
          frameId: firstFrame?.frameId || lastFrame?.frameId || null,
          startTime: staticSegment.startTime,
          endTime: staticSegment.endTime,
          duration: staticSegment.duration,

          // First frame data
          firstFrameImageUrl: firstFrame?.url || null,
          firstFramePhash: firstFrame?.phash || null,
          firstFrameIsDuplicate: firstFrame?.duplicateOf !== null,
          firstFrameDuplicateOfSegmentId:
            firstFrame?.duplicateOf?.segmentId ?? null,
          firstFrameDuplicateOfFramePosition:
            firstFrame?.duplicateOf?.framePosition ?? null,
          firstFrameSkipReason: firstFrame?.skipReason ?? null,

          // Last frame data
          lastFrameImageUrl: lastFrame?.url || null,
          lastFramePhash: lastFrame?.phash || null,
          lastFrameIsDuplicate: lastFrame?.duplicateOf !== null,
          lastFrameDuplicateOfSegmentId:
            lastFrame?.duplicateOf?.segmentId ?? null,
          lastFrameDuplicateOfFramePosition:
            lastFrame?.duplicateOf?.framePosition ?? null,
          lastFrameSkipReason: lastFrame?.skipReason ?? null,
        })
        .onConflictDoNothing();

      savedSlides.push(slideData);
      console.log(
        `💾 saveSlidesToDatabase: Saved slide ${slideIndex} for video ${videoId}`,
      );
    } catch (dbError) {
      console.error(
        `💾 saveSlidesToDatabase: Failed to save slide ${slideIndex} for video ${videoId}:`,
        dbError,
      );
      // Continue with other slides even if one fails
      slideData.dbError = `Database save failed: ${dbError instanceof Error ? dbError.message : "Unknown error"}`;
      savedSlides.push(slideData);
    }

    slideIndex++;
  }

  console.log(
    `💾 saveSlidesToDatabase: Completed saving ${savedSlides.length} slides for video ${videoId}`,
  );

  return { savedSlides, totalSlides: savedSlides.length };
}
