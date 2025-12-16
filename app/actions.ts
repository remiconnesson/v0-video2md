"use server";

import { z } from "zod";
import { extractYoutubeVideoId } from "@/lib/youtube-utils";

import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "@/app/workflows/steps/fetch-transcript";
import {
  getTranscriptDataFromDb,
  type TranscriptData,
} from "@/app/workflows/steps/transcript-analysis";

const videoIdSchema = z.object({
  videoId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube Video ID"),
});

export async function validateVideoId(_prevState: unknown, formData: FormData) {
  const input = (formData.get("videoId") as string | null) || "";

  // Extract video ID from URL if a full URL was provided
  const videoId = extractYoutubeVideoId(input) || input;

  const parsed = videoIdSchema.safeParse({ videoId });

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

export async function fetchAndSaveTranscriptWorkflow(videoId: string) {
  console.log("[fetchAndSaveTranscript] 1. Start, videoId:", videoId);

  const cachedTranscriptData = await getTranscriptDataFromDb(videoId);
  console.log("[fetchAndSaveTranscript] 2. Cached:", !!cachedTranscriptData);

  let transcriptData: TranscriptData | null;

  if (cachedTranscriptData) {
    transcriptData = cachedTranscriptData;
  } else {
    console.log("[fetchAndSaveTranscript] 3. Fetching from Apify...");
    const fetchedResult = await fetchYoutubeTranscriptFromApify(videoId);
    console.log("[fetchAndSaveTranscript] 4. Saving to DB...");
    await saveYoutubeTranscriptToDb(fetchedResult);
    // biome-ignore lint/style/noNonNullAssertion: we know the transcript data is not null
    transcriptData = (await getTranscriptDataFromDb(videoId))!;
  }

  console.log("[fetchAndSaveTranscript] 5. Returning:", transcriptData?.title);
  return transcriptData;
}
