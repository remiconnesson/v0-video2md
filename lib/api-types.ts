import { z } from "zod";

// ============================================================================
// Video Status Types
// ============================================================================

export const videoStatusSchema = z.enum(["not_found", "processing", "ready"]);
export type VideoStatus = z.infer<typeof videoStatusSchema>;

export const videoInfoSchema = z.object({
  title: z.string(),
  channelName: z.string().nullable(),
  thumbnail: z.string().nullable(),
});
export type VideoInfo = z.infer<typeof videoInfoSchema>;

export const videoStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("not_found"),
    video: z.null(),
  }),
  z.object({
    status: z.literal("processing"),
    video: videoInfoSchema,
  }),
  z.object({
    status: z.literal("ready"),
    video: videoInfoSchema,
  }),
]);
export type VideoStatusResponse = z.infer<typeof videoStatusResponseSchema>;

// ============================================================================
// Analysis Types (matching database schema)
// ============================================================================

export const analysisStatusSchema = z.enum([
  "pending",
  "streaming",
  "completed",
  "failed",
]);
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

export const analysisRunSchema = z.object({
  id: z.number(),
  version: z.number(),
  status: analysisStatusSchema,
  result: z.record(z.string(), z.unknown()).nullable(),
  additionalInstructions: z.string().nullable(),
  createdAt: z.string().datetime(), // ISO string format
});
export type AnalysisRun = z.infer<typeof analysisRunSchema>;

export const analyzeResponseSchema = z.object({
  videoId: z.string(),
  runs: z.array(analysisRunSchema),
  latestVersion: z.number(),
});
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

// ============================================================================
// Request Types
// ============================================================================

export const startAnalysisRequestSchema = z.object({
  additionalInstructions: z.string().optional(),
});
export type StartAnalysisRequest = z.infer<typeof startAnalysisRequestSchema>;
