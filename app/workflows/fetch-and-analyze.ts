import { getWritable } from "workflow";
import type { TranscriptResult } from "@/db/save-transcript";
import { formatTranscriptForLLMPadded } from "@/lib/transcript-format";
import {
  completeRun,
  createAnalysisRun,
  failRun,
  runGodPrompt,
  type TranscriptData,
} from "./steps/dynamic-analysis";
import {
  stepCheckDbForTranscript,
  stepFetchFromApify,
  stepSaveToDb,
} from "./steps/fetch-transcript";

// ============================================================================
// Unified Stream Event Types
// ============================================================================

export type UnifiedStreamEvent =
  | { type: "progress"; progress: number; phase: string; message: string }
  | { type: "partial"; data: unknown }
  | { type: "result"; data: unknown }
  | {
      type: "complete";
      runId: number;
      video: { title: string; channelName: string };
    }
  | { type: "error"; error: string };

// ============================================================================
// Unified Stream Emitters
// ============================================================================

async function emitProgress(progress: number, phase: string, message: string) {
  "use step";

  const writable = getWritable<UnifiedStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", progress, phase, message });
  writer.releaseLock();
}

async function emitComplete(
  runId: number,
  video: { title: string; channelName: string },
) {
  "use step";

  const writable = getWritable<UnifiedStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", runId, video });
  writer.releaseLock();
  await writable.close();
}

async function emitError(errorMessage: string) {
  "use step";

  const writable = getWritable<UnifiedStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", error: errorMessage });
  writer.releaseLock();
  await writable.close();
}

// ============================================================================
// Main Unified Workflow
// ============================================================================

export async function fetchAndAnalyzeWorkflow(
  videoId: string,
  additionalInstructions?: string,
) {
  "use workflow";

  let dbRunId: number | undefined;
  let transcriptData: TranscriptResult | TranscriptData | undefined;

  try {
    // ========================================================================
    // Phase A: Transcript Acquisition (0% - 40%)
    // ========================================================================

    // Step 1: Check database for existing transcript
    await emitProgress(
      5,
      "fetching",
      "Checking database for existing transcript...",
    );

    const cachedResult = await stepCheckDbForTranscript(videoId);

    if (cachedResult) {
      await emitProgress(
        25,
        "fetching",
        "Transcript found in database, skipping API call...",
      );
      transcriptData = cachedResult;
    } else {
      // Step 2: Fetch from Apify
      await emitProgress(15, "fetching", "Fetching transcript from YouTube...");

      const fetchedResult = await stepFetchFromApify(videoId);

      if (!fetchedResult) {
        await emitError(`No results found for video ID: ${videoId}`);
        throw new Error(`Apify returned no results for video ID: ${videoId}`);
      }

      // Step 3: Save to database
      await emitProgress(35, "fetching", "Saving video data to database...");
      await stepSaveToDb(fetchedResult);

      transcriptData = fetchedResult;
    }

    // transcriptData is guaranteed to be assigned at this point

    // ========================================================================
    // Phase B: AI Analysis (40% - 90%)
    // ========================================================================

    // Step 4: Create analysis run record (atomic step)
    await emitProgress(40, "analyzing", "Preparing analysis run...");

    dbRunId = await createAnalysisRun(videoId, additionalInstructions);

    // Step 5: Run AI analysis
    await emitProgress(
      50,
      "analyzing",
      "Analyzing transcript and generating extraction schema...",
    );

    // Convert TranscriptResult to TranscriptData for analysis
    const dataForAnalysis: TranscriptData = {
      videoId: transcriptData.id,
      title: transcriptData.title,
      channelName: transcriptData.channelName,
      description: transcriptData.description,
      // Format transcript with timestamps for LLM
      transcript: formatTranscriptForLLMPadded(transcriptData.transcript),
    };

    const analysisResult = await runGodPrompt(
      dataForAnalysis,
      additionalInstructions,
    );

    // ========================================================================
    // Phase C: Persistence (90% - 100%)
    // ========================================================================

    // Step 6: Save analysis to database
    await emitProgress(90, "saving", "Saving analysis to database...");

    await completeRun(dbRunId, analysisResult);

    // Step 7: Complete
    await emitProgress(100, "saving", "Analysis complete");

    await emitComplete(dbRunId, {
      title: transcriptData.title,
      channelName: transcriptData.channelName,
    });

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

    await emitError(errorMessage);
    throw error;
  }
}
