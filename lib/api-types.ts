import { z } from "zod";
import { SlideDataSchema, SlideFeedbackDataSchema } from "./slides-types";

// ============================================================================
// Video Status Types
// ============================================================================

const videoInfoSchema = z.object({
  title: z.string(),
  channelName: z.string().nullable(),
  thumbnail: z.string().nullable(),
});

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
// Slides API Types
// ============================================================================

export const slidesResponseSchema = z.object({
  status: z.string(),
  runId: z.string().nullable(),
  totalSlides: z.number(),
  errorMessage: z.string().nullable(),
  slides: z.array(SlideDataSchema),
});
export type SlidesResponse = z.infer<typeof slidesResponseSchema>;

export const slideFeedbackResponseSchema = z.object({
  feedback: z.array(SlideFeedbackDataSchema),
});
export type SlideFeedbackResponse = z.infer<typeof slideFeedbackResponseSchema>;

export const slideAnalysisResultSchema = z.object({
  slideNumber: z.number(),
  framePosition: z.enum(["first", "last"]),
  markdown: z.string(),
  createdAt: z.string().optional(),
});
export type SlideAnalysisResult = z.infer<typeof slideAnalysisResultSchema>;

export const slideAnalysisResultsResponseSchema = z.object({
  results: z.array(slideAnalysisResultSchema),
});
export type SlideAnalysisResultsResponse = z.infer<
  typeof slideAnalysisResultsResponseSchema
>;
