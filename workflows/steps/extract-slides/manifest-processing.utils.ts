/**
 * Pure utility functions for slide metadata processing.
 * Extracted from workflow steps for testability and reuse.
 */

import type { FrameMetadata, Segment } from "@/lib/slides-types";

export interface ProcessedFrame {
  imageUrl: string | null;
  isDuplicate: boolean;
  duplicateOfSegmentId: number | null;
  duplicateOfFramePosition: string | null;
  skipReason: string | null;
}

/**
 * Determines if a static segment has any usable frames.
 * A segment is usable if it has at least one frame.
 */
export function hasUsableFrames(segment: Segment): boolean {
  // Only static segments have frames
  if (segment.kind !== "static") {
    return false;
  }

  const firstFrame = segment.first_frame;
  const lastFrame = segment.last_frame;

  return Boolean(firstFrame || lastFrame);
}

/**
 * Extracts frame metadata into a normalized format.
 * @param frame - Raw frame metadata from manifest
 * @param imageUrl - Processed public image URL (or null if processing failed)
 */
export function normalizeFrameMetadata(
  frame: FrameMetadata | undefined,
  imageUrl: string | null,
): ProcessedFrame {
  if (!frame) {
    return {
      imageUrl: null,
      isDuplicate: false,
      duplicateOfSegmentId: null,
      duplicateOfFramePosition: null,
      skipReason: null,
    };
  }

  return {
    imageUrl,
    isDuplicate: frame.duplicate_of !== null,
    duplicateOfSegmentId: frame.duplicate_of?.segment_id ?? null,
    duplicateOfFramePosition: frame.duplicate_of?.frame_position ?? null,
    skipReason: frame.skip_reason,
  };
}

/**
 * Generates a blob storage path for a slide image.
 * @param videoId - YouTube video ID
 * @param frameId - Frame identifier
 * @param slideIndex - Index of the slide
 * @param framePosition - "first" or "last"
 */
export function generateBlobPath(
  videoId: string,
  frameId: string | null,
  slideIndex: number,
  framePosition: "first" | "last",
): string {
  const identifier = frameId || `${slideIndex}-${framePosition}`;
  return `slides/${videoId}/${identifier}.webp`;
}

/**
 * Filters static segments from a list of segments.
 * @param segments - Mixed array of segments
 * @returns Only static segments
 */
export function filterStaticSegments(segments: Segment[]): Segment[] {
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
