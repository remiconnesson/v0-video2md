import {
  type AnalysisStreamEvent,
  completeExternalTranscriptRun,
  emitComplete,
  emitError,
  emitProgress,
  failExternalTranscriptRun,
  fetchExternalTranscriptData,
  runExternalTranscriptGodPrompt,
} from "./steps/external-transcript-analysis";

// Re-export the event type for external use
export type { AnalysisStreamEvent };

// ============================================================================
// Main Workflow
// ============================================================================

export async function externalTranscriptAnalysisWorkflow(
  transcriptId: string,
  additionalInstructions?: string,
  dbRunId?: number,
) {
  "use workflow";

  try {
    if (!dbRunId) {
      throw new Error(
        "Missing dbRunId for external transcript analysis run",
      );
    }

    // Step 1: Fetch transcript from external_transcripts table
    await emitProgress("fetching", "Loading transcript data...");
    const transcriptData = await fetchExternalTranscriptData(transcriptId);

    if (!transcriptData) {
      throw new Error(`No transcript found: ${transcriptId}`);
    }

    // Step 2: Run god prompt analysis
    await emitProgress(
      "analyzing",
      "Analyzing transcript and generating extraction schema...",
    );

    const analysisResult = await runExternalTranscriptGodPrompt(
      transcriptData,
      additionalInstructions,
    );

    // Step 3: Update the run to completed
    await emitProgress("saving", "Saving analysis to database...");

    await completeExternalTranscriptRun(dbRunId, analysisResult);
    await emitComplete(dbRunId);

    return {
      success: true,
      dbRunId,
    };
  } catch (error) {
    if (dbRunId) {
      await failExternalTranscriptRun(dbRunId);
    }

    const errorMessage =
      error instanceof Error ? error.message : "Analysis failed unexpectedly";
    await emitError(errorMessage);
    throw error;
  }
}
