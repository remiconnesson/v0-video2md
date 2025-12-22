// ============================================================================
// Loading Status - Common loading states across different features
// ============================================================================

export const LoadingStatus = {
  IDLE: "idle",
  LOADING: "loading",
  STREAMING: "streaming",
  READY: "ready",
  ERROR: "error",
} as const;

export type LoadingStatusType =
  (typeof LoadingStatus)[keyof typeof LoadingStatus];

// ============================================================================
// Slides Status - Specific to slide extraction operations
// ============================================================================

export const SlidesStatus = {
  IDLE: "idle",
  LOADING: "loading",
  EXTRACTING: "extracting",
  COMPLETED: "completed",
  ERROR: "error",
} as const;

export type SlidesStatusType = (typeof SlidesStatus)[keyof typeof SlidesStatus];

// ============================================================================
// Slide Analysis Status - Specific to slide analysis operations
// ============================================================================

export const SlideAnalysisStatus = {
  IDLE: "idle",
  LOADING: "loading",
  ANALYZING: "analyzing",
  COMPLETED: "completed",
  ERROR: "error",
  STREAMING: "streaming", // For streaming analysis
} as const;

export type SlideAnalysisStatusType =
  (typeof SlideAnalysisStatus)[keyof typeof SlideAnalysisStatus];

// ============================================================================
// Coverage Status - For slide coverage checking
// ============================================================================

export const CoverageStatus = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const;

export type CoverageStatusType =
  (typeof CoverageStatus)[keyof typeof CoverageStatus];

// ============================================================================
// Job Status - For external job processing (from VPS)
// ============================================================================

export enum JobStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  EXTRACTING = "extracting",
  UPLOADING = "uploading",
  COMPLETED = "completed",
  FAILED = "failed",
}
