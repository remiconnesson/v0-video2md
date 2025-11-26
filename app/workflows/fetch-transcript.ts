import { ApifyClient } from "apify-client";
import { fetch, getWritable } from "workflow";
import { generateTranscriptToBook } from "@/ai/transcript-to-book";
import type { TranscriptToBook } from "@/ai/transcript-to-book-schema";
import { db } from "@/db";
import {
  saveTranscriptToDb,
  type TranscriptResult,
  type TranscriptSegment,
} from "@/db/save-transcript";
import { videoBookContent } from "@/db/schema";

// Types for streaming progress events
export type TranscriptWorkflowEvent =
  | { type: "progress"; step: string; message: string }
  | { type: "complete"; bookContent: TranscriptToBook }
  | { type: "error"; message: string };

async function emitProgress(step: string, message: string) {
  "use step";

  const writable = getWritable<TranscriptWorkflowEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", step, message });
  writer.releaseLock();
}

async function emitComplete(bookContent: TranscriptToBook) {
  "use step";

  const writable = getWritable<TranscriptWorkflowEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", bookContent });
  writer.releaseLock();
  await writable.close();
}

async function emitError(message: string) {
  "use step";

  const writable = getWritable<TranscriptWorkflowEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", message });
  writer.releaseLock();
  await writable.close();
}

const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatTranscriptString = (segments: TranscriptSegment[]): string =>
  segments
    .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join("\n");

export async function fetchAndStoreTranscriptWorkflow(videoId: string) {
  "use workflow";

  await emitProgress("fetching", "Fetching transcript from YouTube...");

  const apifyResult = await stepFetchFromApify(videoId);

  if (!apifyResult) {
    await emitError(`No results found for video ID: ${videoId}`);
    throw new Error(`Apify returned no results for video ID: ${videoId}`);
  }

  await emitProgress("saving", "Saving video data to database...");

  await stepSaveToDb(apifyResult);

  let bookContent: TranscriptToBook | null = null;

  if (apifyResult.transcript && apifyResult.transcript.length > 0) {
    await emitProgress("analyzing", "Generating chapter analysis...");

    bookContent = await stepGenerateBookContent({
      transcript: apifyResult.transcript,
      title: apifyResult.title,
      description: apifyResult.description,
      channelName: apifyResult.channelName,
    });

    if (bookContent) {
      await emitProgress("finalizing", "Saving analysis results...");
      await stepSaveBookContent(apifyResult.id, bookContent);
      await emitComplete(bookContent);
    }
  }

  return {
    success: true,
    videoId: apifyResult.id,
    title: apifyResult.title,
    hasBookContent: bookContent !== null,
    chapters: bookContent?.chapters || [],
  };
}

async function stepFetchFromApify(videoId: string) {
  "use step";

  if (!process.env.APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN is not defined");
  }

  const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });
  const run = await client.actor("Uwpce1RSXlrzF6WBA").call({
    youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rawResult = items[0];

  // Log the raw API response to understand field names
  console.log(
    "[Apify] Raw response keys:",
    rawResult ? Object.keys(rawResult) : "null",
  );
  console.log("[Apify] Raw response:", JSON.stringify(rawResult, null, 2));

  return (rawResult as unknown as TranscriptResult | undefined) ?? null;
}

async function stepSaveToDb(data: TranscriptResult) {
  "use step";

  await saveTranscriptToDb(data);
}

async function stepGenerateBookContent(input: {
  transcript: TranscriptSegment[];
  title: string;
  description?: string;
  channelName?: string;
}): Promise<TranscriptToBook> {
  "use step";

  globalThis.fetch = fetch;

  const transcriptString = formatTranscriptString(input.transcript);

  return generateTranscriptToBook({
    transcriptString,
    title: input.title,
    description: input.description,
    channelName: input.channelName,
  });
}

async function stepSaveBookContent(videoId: string, content: TranscriptToBook) {
  "use step";

  await db
    .insert(videoBookContent)
    .values({
      videoId,
      videoSummary: content.videoSummary,
      chapters: content.chapters,
    })
    .onConflictDoUpdate({
      target: videoBookContent.videoId,
      set: {
        videoSummary: content.videoSummary,
        chapters: content.chapters,
        updatedAt: new Date(),
      },
    });
}
