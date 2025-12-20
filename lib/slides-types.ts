import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { slideFeedback, videoSlides } from "@/db/schema";

const FrameMetadataSchema = z.object({
  frame_id: z.string(),
  duplicate_of: z
    .object({
      segment_id: z.number(),
      frame_position: z.enum(["first", "last"]),
    })
    .nullable(),
  url: z.string(),
});

const StaticSegmentSchema = z.object({
  kind: z.literal("static"),
  start_time: z.number(),
  end_time: z.number(),
  duration: z.number(),
  first_frame: FrameMetadataSchema,
  last_frame: FrameMetadataSchema,
  url: z.string().optional(), // Add this if you want to allow the extra url
});

const MovingSegmentSchema = z.object({
  kind: z.literal("moving"),
  start_time: z.number(),
  end_time: z.number(),
  duration: z.number(),
  // No frame properties for moving segments
});

const SegmentSchema = z.discriminatedUnion("kind", [
  StaticSegmentSchema,
  MovingSegmentSchema,
]);

const ManifestDataSchema = z.object({
  segments: z.array(SegmentSchema),
  updated_at: z.iso.datetime({ offset: true }), // ISO 8601 timestamp
});

export const VideoManifestSchema = z.record(z.string(), ManifestDataSchema); // video_id -> manifest data

export type FrameMetadata = z.infer<typeof FrameMetadataSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type StaticSegmentData = z.infer<typeof StaticSegmentSchema>;
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

export const SlideDataSchema = createSelectSchema(videoSlides).omit({
  id: true,
  videoId: true,
  createdAt: true,
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
