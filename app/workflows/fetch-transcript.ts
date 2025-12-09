import type { TranscriptResult } from "@/db/save-transcript";
import {
  emitComplete,
  emitError,
  emitProgress,
  stepCheckDbForTranscript,
  stepFetchFromApify,
  stepSaveToDb,
  type TranscriptStreamEvent,
} from "./steps/transcript";

// Re-export the event type for external use
export type { TranscriptStreamEvent };

// ============================================================================
// Main Workflow
// ============================================================================

export async function fetchTranscriptWorkflow(videoId: string) {
  "use workflow";

  try {
    // Step 1: Check if we already have the transcript in the database
    await emitProgress(10, "Checking database for existing transcript...");

    const cachedResult = await stepCheckDbForTranscript(videoId);

    let transcriptData: TranscriptResult;

    if (cachedResult) {
      await emitProgress(
        50,
        "Transcript found in database, skipping API call...",
      );
      transcriptData = cachedResult;
    } else {
      // Step 2: Fetch from Apify
      await emitProgress(20, "Fetching transcript from YouTube...");

      const fetchedResult = await stepFetchFromApify(videoId);

      if (!fetchedResult) {
        await emitError(`No results found for video ID: ${videoId}`);
        throw new Error(`Apify returned no results for video ID: ${videoId}`);
      }

      // Step 3: Save to database
      await emitProgress(80, "Saving video data to database...");
      await stepSaveToDb(fetchedResult);

      transcriptData = fetchedResult;
    }

    // Step 4: Complete
    await emitComplete({
      title: transcriptData.title,
      channelName: transcriptData.channelName,
    });

    return {
      success: true,
      videoId: transcriptData.id,
      title: transcriptData.title,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    await emitError(errorMessage);
    throw error;
  }
}
