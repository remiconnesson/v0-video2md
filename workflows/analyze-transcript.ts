import { getWritable } from "workflow";
import { DurableAgent } from "@workflow/ai/agent";
import { z } from "zod";
import { getCompletedAnalysis } from "@/db/queries";
import { type YouTubeVideoId } from "@/lib/youtube-utils";
import type { UIMessageChunk } from "ai";
import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "./steps/fetch-transcript";
import {
  type AnalysisStreamEvent,
  getTranscriptDataFromDb,
  type TranscriptData,
} from "./steps/transcript-analysis";
import { recordSection } from "./steps/durable-analysis";
import {
  DURABLE_ANALYSIS_SYSTEM_PROMPT,
  buildDurableAgentUserMessage,
} from "@/ai/durable-analysis-prompt";

export async function analyzeTranscriptWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<AnalysisStreamEvent>();
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

  console.log("🤖 Analyzing transcript for video (Durable Agent)", videoId);

  const agent = new DurableAgent({
    model: "openai/gpt-4o",
    system: DURABLE_ANALYSIS_SYSTEM_PROMPT,
    tools: {
      recordSection: {
        description: "Record a section of the analysis",
        inputSchema: z.object({
          videoId: z.string(),
          key: z.string(),
          content: z.any(),
        }),
        execute: recordSection,
      },
    },
  });

  const userMessage = buildDurableAgentUserMessage({
    videoId: transcriptData.videoId,
    title: transcriptData.title,
    channelName: transcriptData.channelName,
    description: transcriptData.description ?? undefined,
    transcript: transcriptData.transcript,
  });

  const writer = writable.getWriter();
  await writer.write({
    type: "progress",
    phase: "analysis",
    message: "Starting analysis with Durable Agent...",
  });
  writer.releaseLock();

  const agentWritable = new WritableStream<UIMessageChunk>({
    write(_chunk) {
      // Consume the stream
    },
  });

  await agent.stream({
    messages: [{ role: "user", content: userMessage }],
    writable: agentWritable,
  });

  console.log("🤖 Analysis complete for video", videoId);

  // Fetch final result to ensure we return what was saved
  const finalResult = await getCompletedAnalysis(videoId as YouTubeVideoId);

  if (finalResult?.result) {
    const writer = writable.getWriter();
    await writer.write({ type: "result", data: finalResult.result });
    writer.releaseLock();
  }

  return {
    success: true,
    title: transcriptData.title,
  };
}
