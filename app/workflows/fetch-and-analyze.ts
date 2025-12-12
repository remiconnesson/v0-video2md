import type { TranscriptResult } from "@/db/save-transcript";
import {
  createAnalysisRun,
  failRun,
  runGodPrompt,
  type TranscriptData,
} from "./steps/dynamic-analysis";
import {
  stepCheckDbForTranscript,
  stepFetchFromApify,
} from "./steps/fetch-transcript";

export async function fetchAndAnalyzeWorkflow(
  videoId: string,
  additionalInstructions?: string,
) {
  "use workflow";

  let dbRunId: number | undefined;
  let transcriptData: TranscriptResult | TranscriptData | undefined;

  try {
    const cachedResult = await stepCheckDbForTranscript(videoId);

    if (cachedResult) {
      transcriptData = cachedResult;
    } else {
      const fetchedResult = await stepFetchFromApify(videoId);
      transcriptData = fetchedResult;
    }

    const analysisResult = await runGodPrompt(
      transcriptData,
      additionalInstructions,
    );

    await completeRun(dbRunId, analysisResult);

    return {
      success: true,
      videoId,
      runId: dbRunId,
      title: transcriptData.title,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Mark run as failed if it was created
    if (dbRunId) {
      await failRun(dbRunId);
    }

    throw error;
  }
}
