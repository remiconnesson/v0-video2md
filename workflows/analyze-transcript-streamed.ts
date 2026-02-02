/**
 * Streamed Transcript Analysis Workflow with DurableAgent
 *
 * This workflow analyzes video transcripts using Workflow DevKit's DurableAgent.
 * Each section tool call is a durable workflow step that immediately saves
 * to the database.
 *
 * If the workflow times out or crashes, already-completed sections persist
 * and the workflow can resume from where it left off.
 */

import type { UIMessageChunk } from "ai";
import { getWritable } from "workflow";
import {
  buildAnalysisUserPrompt,
  createSectionAnalysisAgent,
} from "@/ai/streamed-section-analysis";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "./steps/fetch-transcript";
import {
  failStreamedAnalysis,
  finalizeStreamedAnalysis,
  getTranscriptDataFromDb,
  initializeStreamedAnalysis,
  type TranscriptData,
} from "./steps/transcript-analysis";

export async function analyzeTranscriptStreamedWorkflow(videoId: string) {
  "use workflow";

  // Validate videoId at workflow boundary before any DB or network work
  if (!isValidYouTubeVideoId(videoId)) {
    throw new Error(`Invalid YouTube videoId: ${videoId}`);
  }

  // DurableAgent streams to UIMessageChunk
  const writable = getWritable<UIMessageChunk>();
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
  await initializeStreamedAnalysis(videoId);

  try {
    console.log("🤖 Running DurableAgent analysis for video", videoId);

    // Create the DurableAgent with the emit_section tool
    const agent = createSectionAnalysisAgent(videoId);

    // Build the user message with the transcript
    const userMessage = buildAnalysisUserPrompt({
      videoId,
      title: transcriptData.title,
      channelName: transcriptData.channelName,
      description: transcriptData.description ?? undefined,
      transcript: transcriptData.transcript,
    });

    // Run the agent - tool calls are durable steps
    await agent.stream({
      messages: [{ role: "user", content: userMessage }],
      writable,
    });

    console.log("🤖 Finalizing analysis for video", videoId);
    await finalizeStreamedAnalysis(videoId);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("🤖 Analysis failed for video", videoId, errorMessage);
    await failStreamedAnalysis(videoId, errorMessage);
    throw error; // Re-throw to let the workflow handle it
  }

  console.log("🤖 Streamed analysis complete for video", videoId);

  return {
    success: true,
    title: transcriptData.title,
  };
}
