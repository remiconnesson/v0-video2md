import { db } from "@/db";
import { videoAnalysisRuns } from "@/db/schema";
import {
  type AnalysisStreamEvent,
  completeRun,
  emitComplete,
  emitError,
  emitProgress,
  failRun,
  fetchTranscriptData,
  getNextVersion,
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

    if (dbRunId) {
      await completeRun(dbRunId, result);
      await emitComplete(dbRunId);
    } else {
      // Fallback for old-style calls without dbRunId (shouldn't happen in normal flow)
      const version = await getNextVersion(videoId);
      const [inserted] = await db
        .insert(videoAnalysisRuns)
        .values({
          videoId,
          version,
          result,
          additionalInstructions: additionalInstructions ?? null,
          status: "completed",
          updatedAt: new Date(),
        })
        .returning({ id: videoAnalysisRuns.id });
      await emitComplete(inserted.id);
    }

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
