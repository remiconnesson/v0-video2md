import { z } from "zod";

// ============================================================================
// Manifest Schema (matches your S3 output)
// ============================================================================

const DuplicateOfSchema = z.object({
  segment_id: z.number(),
  frame_position: z.string(),
});

const FrameMetadataSchema = z.object({
  frame_id: z.string().nullable(),
  has_text: z.boolean(),
  text_confidence: z.number(),
  text_total_area_ratio: z.number(),
  text_largest_area_ratio: z.number(),
  text_box_count: z.number(),
  duplicate_of: DuplicateOfSchema.nullable(),
  skip_reason: z.string().nullable(),
  s3_key: z.string().nullable(),
  s3_bucket: z.string().nullable(),
  s3_uri: z.string().nullable(),
  url: z.string().nullable(),
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
  url: z.string().nullable().optional(),
  has_text: z.boolean().optional(),
  text_confidence: z.number().optional(),
});

const SegmentSchema = z.discriminatedUnion("kind", [
  MovingSegmentSchema,
  StaticSegmentSchema,
]);

const VideoDataSchema = z.object({
  segments: z.array(SegmentSchema),
  updated_at: z.string().datetime(),
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

export interface SlideData {
  slideIndex: number;
  frameId: string | null;
  startTime: number;
  endTime: number;
  duration: number;
  s3Uri: string | null;
  hasText: boolean;
  textConfidence: number;
  isDuplicate: boolean;
  imageProcessingError?: string | null;
  dbError?: string | null;
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
