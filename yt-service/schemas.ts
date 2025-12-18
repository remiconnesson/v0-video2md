/**
 * Zod schemas for API request/response validation.
 */

import { z } from "zod";
import { JobStatus } from "./types";

// Video ID validation (YouTube video IDs are 11 characters)
export const videoIdSchema = z.string().min(1).max(20);

// Job status enum schema
export const jobStatusSchema = z.nativeEnum(JobStatus);

// Job schema
export const jobSchema = z.object({
  videoId: z.string(),
  status: jobStatusSchema,
  progress: z.number().min(0).max(100),
  message: z.string(),
  updatedAt: z.string().datetime(),
  metadataUri: z.string().optional(),
  error: z.string().optional(),
  frameCount: z.number().int().optional(),
});

// Process request params
export const processParamsSchema = z.object({
  videoId: videoIdSchema,
});

// API response schemas
export const healthResponseSchema = z.object({
  status: z.enum(["alive", "ready", "draining"]),
});

export const errorResponseSchema = z.object({
  error: z.string(),
  detail: z.string().optional(),
});

export const processResponseSchema = z.object({
  message: z.string(),
  videoId: z.string(),
  track: z.string(),
  stream: z.string(),
  job: jobSchema.optional(),
});

// Type exports from schemas
export type VideoIdParam = z.infer<typeof videoIdSchema>;
export type JobSchema = z.infer<typeof jobSchema>;
export type ProcessParams = z.infer<typeof processParamsSchema>;
