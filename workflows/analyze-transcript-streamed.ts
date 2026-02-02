/**
 * Streamed Transcript Analysis Workflow
 *
 * This workflow analyzes video transcripts using a durable section-by-section approach.
 * Unlike the original workflow that saves results only at the end, this one saves
 * each section to the database as soon as it's generated via tool calls.
 *
 * If the workflow times out or fails, already-completed sections persist in the database.
 */

import { getWritable } from "workflow";
import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "./steps/fetch-transcript";
import {
  doStreamedSectionAnalysis,
  failStreamedAnalysis,
  finalizeStreamedAnalysis,
  getTranscriptDataFromDb,
  initializeStreamedAnalysis,
  type SectionAnalysisStreamEvent,
  type TranscriptData,
} from "./steps/transcript-analysis";

export async function analyzeTranscriptStreamedWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<SectionAnalysisStreamEvent>();
  let transcriptData: TranscriptData | null;

  console.log("Checking cached transcript for video", videoId);

  const cachedTranscriptData = await getTranscriptDataFromDb(videoId);

  if (cachedTranscriptData) {
    transcriptData = cachedTranscriptData;
    console.log("🤖 Found cached transcript for video", videoId);
  } else {
    console.log("🤖 No cached transcript found for video", videoId);
    console.log("🤖 Fetching transcript for video", videoId);
    const fetchedResult = await fetchYoutubeTranscriptFromApify(videoId);
    console.log("🤖 Saving transcript for video", videoId);
    await saveYoutubeTranscriptToDb(fetchedResult);
    // biome-ignore lint/style/noNonNullAssertion: we just inserted it into the db
    transcriptData = (await getTranscriptDataFromDb(videoId))!;
  }

  console.log("🤖 Initializing streamed analysis for video", videoId);
  await initializeStreamedAnalysis(videoId, writable);

  try {
    console.log("🤖 Running streamed section analysis for video", videoId);
    await doStreamedSectionAnalysis(transcriptData, writable);

    console.log("🤖 Finalizing analysis for video", videoId);
    await finalizeStreamedAnalysis(videoId, writable);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("🤖 Analysis failed for video", videoId, errorMessage);
    await failStreamedAnalysis(videoId, errorMessage, writable);
    throw error; // Re-throw to let the workflow handle it
  }

  console.log("🤖 Streamed analysis complete for video", videoId);

  return {
    success: true,
    title: transcriptData.title,
  };
}
