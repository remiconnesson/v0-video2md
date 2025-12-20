import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { slideFeedback, videoSlides } from "@/db/schema";

const FrameMetadataSchema = z.object({
  frame_id: z.string().nullable(),
  duplicate_of: z
    .object({
      segment_id: z.number(),
      frame_position: z.string(),
    })
    .nullable(),
  url: z.string().nullable(),
});

const SegmentSchema = z.object({
  kind: z.enum(["static", "moving"]),
  start_time: z.number(), // float in seconds
  end_time: z.number(), // float in seconds
  duration: z.number(), // float in seconds
});
  start_time: z.number(), // float in seconds
  end_time: z.number(), // float in seconds
  duration: z.number(), // float in seconds
  first_frame: FrameMetadataSchema.optional(),
  last_frame: FrameMetadataSchema.optional(),
  url: z.string().nullable().optional(),
});

const ManifestDataSchema = z.object({
  segments: z.array(SegmentSchema),
  updated_at: z.string(), // ISO 8601 timestamp
});

export const VideoManifestSchema = z.record(z.string(), ManifestDataSchema); // video_id -> manifest data

export type FrameMetadata = z.infer<typeof FrameMetadataSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type ManifestData = z.infer<typeof ManifestDataSchema>;
export type VideoManifest = z.infer<typeof VideoManifestSchema>;

// ============================================================================
// Stream Event Types (workflow → frontend)
// ============================================================================

export type SlideStreamEvent =
  | { type: "progress"; status: string; progress: number; message: string }
  | { type: "slide"; slide: SlideData }
  | { type: "complete"; totalSlides: number }
  | { type: "error"; message: string };

export const SlideDataSchema = createSelectSchema(videoSlides, {
  firstFrameDuplicateOfFramePosition: z.enum(["first", "last"]).nullable(),
  lastFrameDuplicateOfFramePosition: z.enum(["first", "last"]).nullable(),
  firstFrameIsDuplicate: z.boolean(),
  lastFrameIsDuplicate: z.boolean(),
})
  .omit({
    id: true,
    videoId: true,
    createdAt: true,
  })
  .extend({
    imageProcessingError: z.string().nullish(),
    dbError: z.string().nullish(),
  });

export type SlideData = z.infer<typeof SlideDataSchema>;

// ============================================================================
// Slide Feedback Types
// ============================================================================

export const SlideFeedbackDataSchema = createSelectSchema(slideFeedback).omit({
  id: true,
  videoId: true,
  createdAt: true,
  updatedAt: true,
});

export type SlideFeedbackData = z.infer<typeof SlideFeedbackDataSchema>;

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
