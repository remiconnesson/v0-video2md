import {
  type AnalysisStreamEvent,
  completeRun,
  emitComplete,
  emitError,
  emitProgress,
  failRun,
  fetchTranscriptData,
  runGodPrompt,
} from "./steps/dynamic-analysis";

// Re-export the event type for external use
export type { AnalysisStreamEvent };

// ============================================================================
// Main Workflow
// ============================================================================

export async function dynamicAnalysisWorkflow(
  videoId: string,
  additionalInstructions?: string,
  dbRunId?: number,
) {
  "use workflow";

  try {
    if (!dbRunId) {
      throw new Error("Missing dbRunId for dynamic analysis run");
    }

    // Step 1: Fetch transcript
    await emitProgress("fetching", "Fetching transcript from database...");
    const transcriptData = await fetchTranscriptData(videoId);

    if (!transcriptData) {
      throw new Error(`No transcript found for video: ${videoId}`);
    }

    // Step 2: Run god prompt
    await emitProgress(
      "analyzing",
      "Analyzing transcript and generating extraction schema...",
    );

    const result = await runGodPrompt(transcriptData, additionalInstructions);

    // Step 3: Update the run to completed
    await emitProgress("saving", "Saving analysis to database...");

    await completeRun(dbRunId, result);
    await emitComplete(dbRunId);

    return {
      success: true,
      dbRunId,
    };
  } catch (error) {
    if (dbRunId) {
      await failRun(dbRunId);
    }

    const message =
      error instanceof Error ? error.message : "Analysis failed unexpectedly";
    await emitError(message);
    throw error;
  }
}
