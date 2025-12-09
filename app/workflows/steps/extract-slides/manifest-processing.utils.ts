/**
 * Pure utility functions for slide metadata processing.
 * Extracted from workflow steps for testability and reuse.
 */

import type { FrameMetadata, StaticSegment } from "@/lib/slides-types";

export interface ProcessedFrame {
  imageUrl: string | null;
  hasText: boolean;
  textConfidence: number;
  isDuplicate: boolean;
  duplicateOfSegmentId: number | null;
  duplicateOfFramePosition: string | null;
  skipReason: string | null;
}

/**
 * Determines if a static segment has any usable frames.
 * A segment is usable if it has at least one frame with an S3 URI.
 */
export function hasUsableFrames(segment: StaticSegment): boolean {
  const firstFrame = segment.first_frame;
  const lastFrame = segment.last_frame;

  return Boolean(firstFrame?.s3_uri || lastFrame?.s3_uri);
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
      hasText: false,
      textConfidence: 0,
      isDuplicate: false,
      duplicateOfSegmentId: null,
      duplicateOfFramePosition: null,
      skipReason: null,
    };
  }

  return {
    imageUrl,
    hasText: frame.has_text,
    textConfidence: Math.round(frame.text_confidence * 100),
    isDuplicate: frame.duplicate_of !== null,
    duplicateOfSegmentId: frame.duplicate_of?.segment_id ?? null,
    duplicateOfFramePosition: frame.duplicate_of?.frame_position ?? null,
    skipReason: frame.skip_reason,
  };
}

/**
 * Parses an S3 URI into bucket and key components.
 * @param s3Uri - S3 URI in format "s3://bucket/path/to/key"
 * @returns Object with bucket and key, or null if invalid
 */
export function parseS3Uri(
  s3Uri: string,
): { bucket: string; key: string } | null {
  if (!s3Uri || !s3Uri.startsWith("s3://")) {
    return null;
  }

  const urlParts = s3Uri.replace("s3://", "").split("/");
  const bucket = urlParts.shift();
  const key = urlParts.join("/");

  if (!bucket || !key) {
    return null;
  }

  return { bucket, key };
}

/**
 * Builds a public URL for an S3 object.
 * @param s3BaseUrl - Base URL of the S3-compatible service
 * @param bucket - S3 bucket name
 * @param key - Object key within the bucket
 */
export function buildS3HttpUrl(
  s3BaseUrl: string,
  bucket: string,
  key: string,
): string {
  // Remove trailing slash from base URL if present
  const baseUrl = s3BaseUrl.replace(/\/$/, "");
  return `${baseUrl}/${bucket}/${key}`;
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
export function filterStaticSegments(
  segments: Array<{ kind: string }>,
): StaticSegment[] {
  return segments.filter(
    (s): s is StaticSegment => s.kind === "static",
  ) as StaticSegment[];
}

/**
 * Calculates slide timing information.
 * @param segment - Static segment with timing data
 */
export function extractSlideTimings(segment: StaticSegment): {
  startTime: number;
  endTime: number;
  duration: number;
} {
  return {
    startTime: segment.start_time,
    endTime: segment.end_time,
    duration: segment.duration,
  };
}
