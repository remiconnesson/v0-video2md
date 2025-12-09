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
} from "./steps/analysis";

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

  // Step 1: Fetch transcript
  await emitProgress("fetching", "Fetching transcript from database...");
  const transcriptData = await fetchTranscriptData(videoId);

  if (!transcriptData) {
    if (dbRunId) {
      await failRun(dbRunId);
    }
    await emitError(`No transcript found for video: ${videoId}`);
    throw new Error(`No transcript found for video: ${videoId}`);
  }

  // Step 2: Run god prompt
  await emitProgress(
    "analyzing",
    "Analyzing transcript and generating extraction schema...",
  );

  let result: Record<string, unknown>;
  try {
    result = await runGodPrompt(transcriptData, additionalInstructions);
  } catch (error) {
    if (dbRunId) {
      await failRun(dbRunId);
    }
    throw error;
  }

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
}
