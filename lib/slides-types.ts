import { z } from "zod";
import type { SlideFeedback, VideoSlide } from "@/db/schema";

// ============================================================================
// Manifest Schema (matches your S3 output)
// ============================================================================

const DuplicateOfSchema = z.object({
  segment_id: z.number(),
  frame_position: z.string(),
});

const FrameMetadataSchema = z.object({
  frame_id: z.string().nullable(),
  duplicate_of: DuplicateOfSchema.nullable(),
  skip_reason: z.string().nullable(),
});

const BaseSegmentSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  duration: z.number(),
});

const MovingSegmentSchema = BaseSegmentSchema.extend({
  kind: z.literal("moving"),
});

const StaticSegmentSchema = BaseSegmentSchema.extend({
  kind: z.literal("static"),
  first_frame: FrameMetadataSchema.optional(),
  last_frame: FrameMetadataSchema.optional(),
});

const SegmentSchema = z.discriminatedUnion("kind", [
  MovingSegmentSchema,
  StaticSegmentSchema,
]);

const VideoDataSchema = z.object({
  segments: z.array(SegmentSchema),
  // Allow datetime with offset (e.g., +00:00) or Z suffix, and local times without timezone
  updated_at: z.string().datetime({ offset: true, local: true }),
});

export const VideoManifestSchema = z.record(z.string(), VideoDataSchema);

export type VideoManifest = z.infer<typeof VideoManifestSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type StaticSegment = z.infer<typeof StaticSegmentSchema>;
export type FrameMetadata = z.infer<typeof FrameMetadataSchema>;

// ============================================================================
// Stream Event Types (workflow → frontend)
// ============================================================================

export type SlideStreamEvent =
  | { type: "progress"; status: string; progress: number; message: string }
  | { type: "slide"; slide: SlideData }
  | { type: "complete"; totalSlides: number }
  | { type: "error"; message: string };

export interface SlideData
  extends Omit<
    VideoSlide,
    | "id"
    | "videoId"
    | "createdAt"
    | "firstFrameIsDuplicate"
    | "lastFrameIsDuplicate"
    | "firstFrameDuplicateOfFramePosition"
    | "lastFrameDuplicateOfFramePosition"
  > {
  // First frame data
  firstFrameIsDuplicate: boolean;
  firstFrameDuplicateOfFramePosition: "first" | "last" | null;

  // Last frame data
  lastFrameIsDuplicate: boolean;
  lastFrameDuplicateOfFramePosition: "first" | "last" | null;

  imageProcessingError?: string | null;
  dbError?: string | null;
}

// ============================================================================
// Slide Feedback Types
// ============================================================================

export interface SlideFeedbackData
  extends Omit<
    SlideFeedback,
    "id" | "videoId" | "createdAt" | "updatedAt" | "framesSameness"
  > {
  firstFrameHasTextValidated: boolean | null;
  lastFrameHasTextValidated: boolean | null;
  framesSameness: "same" | "different" | null;
}

// ============================================================================
// Job Status (from VPS)
// ============================================================================

export enum JobStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  EXTRACTING = "extracting",
  UPLOADING = "uploading",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface JobUpdate {
  status: JobStatus;
  progress: number;
  message: string;
  updated_at: string;
  video_id?: string;
  metadata_uri?: string;
  error?: string;
}

// ============================================================================
// Slides State Types
// ============================================================================

export interface SlidesState {
  status: "idle" | "loading" | "extracting" | "completed" | "error";
  progress: number;
  message: string;
  error: string | null;
  slides: SlideData[];
}
