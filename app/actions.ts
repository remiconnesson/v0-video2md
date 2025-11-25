"use server";

import { start } from "workflow/api";
import { z } from "zod";
import { fetchAndStoreTranscriptWorkflow } from "@/app/workflows/fetch-transcript";

const schema = z.object({
  videoId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube Video ID"),
});

export async function triggerTranscript(prevState: unknown, formData: FormData) {
  const videoId = (formData.get("videoId") as string | null) || "";
  const parsed = schema.safeParse({ videoId });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid YouTube Video ID",
    };
  }

  try {
    const run = await start(fetchAndStoreTranscriptWorkflow, [parsed.data.videoId]);

    return {
      success: true,
      runId: run.runId,
      videoId: parsed.data.videoId,
    };
  } catch (error) {
    console.error("Failed to start workflow", error);
    return { success: false, error: "Failed to start workflow" };
  }
}
