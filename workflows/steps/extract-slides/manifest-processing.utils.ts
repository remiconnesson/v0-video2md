/**
 * Pure utility functions for slide metadata processing.
 * Extracted from workflow steps for testability and reuse.
 */

import type {
  FrameMetadata,
  Segment,
  StaticSegmentData,
} from "@/lib/slides-types";

type FrameSide = "firstFrame" | "lastFrame";

type NormalizeIsDuplicateResult<S extends FrameSide> =
  | ({
      readonly [K in `${S}IsDuplicate`]: false;
    } & {
      readonly [K in `${S}DuplicateOfSlideNumber`]: null;
    } & {
      readonly [K in `${S}DuplicateOfFramePosition`]: null;
    })
  | ({
      readonly [K in `${S}IsDuplicate`]: true;
    } & {
      readonly [K in `${S}DuplicateOfSlideNumber`]: number;
    } & {
      readonly [K in `${S}DuplicateOfFramePosition`]: "first" | "last";
    });

export function normalizeIsDuplicate<S extends FrameSide>(
  frame: FrameMetadata,
  firstOrLast: S,
): NormalizeIsDuplicateResult<S> {
  if (frame.duplicate_of === null) {
    return {
      [`${firstOrLast}IsDuplicate`]: false,
      [`${firstOrLast}DuplicateOfSlideNumber`]: null,
      [`${firstOrLast}DuplicateOfFramePosition`]: null,
    } as const as NormalizeIsDuplicateResult<S>;
  }

  return {
    [`${firstOrLast}IsDuplicate`]: true,
    [`${firstOrLast}DuplicateOfSlideNumber`]: frame.duplicate_of.segment_id,
    [`${firstOrLast}DuplicateOfFramePosition`]:
      frame.duplicate_of.frame_position,
  } as const as NormalizeIsDuplicateResult<S>;
}

/**
 * Generates a blob storage path for a slide image.
 * @param videoId - YouTube video ID
 * @param frameId - Frame identifier
 * @param slideNumber - Number of the slide
 * @param framePosition - "first" or "last"
 */
export function generateBlobPath(
  videoId: string,
  frameId: string | null,
  slideNumber: number,
  framePosition: "first" | "last",
): string {
  const identifier = frameId || `${slideNumber}-${framePosition}`;
  return `slides/${videoId}/${identifier}.webp`;
}

/**
 * Filters static segments from a list of segments.
 * @param segments - Mixed array of segments
 * @returns Only static segments
 */
export function filterStaticSegments(segments: Segment[]): StaticSegmentData[] {
  return segments.filter((s) => s.kind === "static");
}

/**
 * Calculates slide timing information.
 * @param segment - Static segment with timing data
 */
export function extractSlideTimings(segment: Segment): {
  startTime: number;
  endTime: number;
  duration: number;
} {
  if (segment.kind !== "static") {
    throw new Error("extractSlideTimings only works with static segments");
  }

  return {
    startTime: segment.start_time,
    endTime: segment.end_time,
    duration: segment.duration,
  };
}
