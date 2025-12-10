import { db } from "@/db";
import { videoSlides } from "@/db/schema";
import type { FrameMetadata, StaticSegment } from "@/lib/slides-types";

interface PersistSlideInput {
  videoId: string;
  slideIndex: number;
  segment: StaticSegment;
  firstFrame?: FrameMetadata;
  lastFrame?: FrameMetadata;
  firstFrameImageUrl: string | null;
  lastFrameImageUrl: string | null;
}

export async function persistSlide({
  videoId,
  slideIndex,
  segment,
  firstFrame,
  lastFrame,
  firstFrameImageUrl,
  lastFrameImageUrl,
}: PersistSlideInput): Promise<{ success: boolean; errorMessage?: string }> {
  try {
    console.log(`💾 persistSlide: Saving slide ${slideIndex} to database`);
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
      `💾 persistSlide: Successfully saved slide ${slideIndex} to database`,
    );
    return { success: true };
  } catch (dbError) {
    const errorMessage = `Database save failed: ${dbError instanceof Error ? dbError.message : "Unknown DB error"}`;
    console.error(
      `💾 persistSlide: Failed to save slide ${slideIndex} to database:`,
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

    return { success: false, errorMessage };
  }
}
