import { z } from "zod";

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
