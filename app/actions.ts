"use server";

import { z } from "zod";
import { extractYoutubeVideoId } from "@/lib/youtube-utils";

const schema = z.object({
  videoId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube Video ID"),
});

export async function triggerTranscript(
  _prevState: unknown,
  formData: FormData,
) {
  const input = (formData.get("videoId") as string | null) || "";

  // Extract video ID from URL if a full URL was provided
  const videoId = extractYoutubeVideoId(input) || input;

  const parsed = schema.safeParse({ videoId });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid YouTube Video ID",
    };
  }

  return {
    success: true,
    videoId: parsed.data.videoId,
  };
}
