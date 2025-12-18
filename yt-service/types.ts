/**
 * Core type definitions for the slides extractor service.
 * Ported from Python: src/slides_extractor/video_service.py
 */

// Job status enum matching Python JobStatus
export enum JobStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  EXTRACTING = "extracting",
  UPLOADING = "uploading",
  COMPLETED = "completed",
  FAILED = "failed",
}

// Active statuses (job is still running)
export const ACTIVE_JOB_STATUSES = new Set([
  JobStatus.PENDING,
  JobStatus.DOWNLOADING,
  JobStatus.EXTRACTING,
  JobStatus.UPLOADING,
]);

// Job state stored in memory
export interface Job {
  videoId: string;
  status: JobStatus;
  progress: number; // 0-100
  message: string;
  updatedAt: string; // ISO 8601 timestamp
  metadataUri?: string;
  error?: string;
  frameCount?: number;
}

// Frame metadata for static segments
export interface FrameMetadata {
  frameId: string;
  phash: string;
  duplicateOf: { segmentId: number; framePosition: "first" | "last" } | null;
  skipReason: string | null;
  blobPath: string;
  url: string;
}

// Segment types
export type SegmentKind = "static" | "moving";

// Base segment interface
export interface BaseSegment {
  kind: SegmentKind;
  startTime: number;
  endTime: number;
  duration: number;
}

// Static segment with frame data
export interface StaticSegment extends BaseSegment {
  kind: "static";
  firstFrame: FrameMetadata | null;
  lastFrame: FrameMetadata | null;
  // Convenience field from first frame
  url?: string;
}

// Moving segment (no frame data)
export interface MovingSegment extends BaseSegment {
  kind: "moving";
}

// Union type for all segments
export type Segment = StaticSegment | MovingSegment;

// Video segments manifest (stored in Vercel Blob)
export interface VideoManifest {
  [videoId: string]: {
    segments: Segment[];
    updatedAt: string;
  };
}

// Download result type
export interface DownloadResult {
  success: boolean;
  path?: string;
  error?: string;
}

// Stream URLs from YouTube
export interface StreamUrls {
  videoUrl: string | null;
  audioUrl: string | null;
  title: string | null;
}

// API response types
export interface JobResponse {
  videoId: string;
  status: JobStatus;
  streamUrl: string;
}

export interface ProcessResponse {
  message: string;
  videoId: string;
  track: string;
  stream: string;
  job?: Job;
}

export interface HealthResponse {
  status: "alive" | "ready" | "draining";
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}

// Progress tracking for downloads
export interface DownloadProgress {
  filename: string;
  totalSize: number;
  downloadedSize: number;
  status: "pending" | "downloading" | "merging" | "complete" | "failed";
  percentage: number;
}
