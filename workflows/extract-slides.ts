import { FatalError, getWritable } from "workflow";
import type { SlideStreamEvent } from "@/lib/slides-types";
import { emit } from "@/lib/stream-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import {
  checkJobStatus,
  fetchManifest,
  processSlidesFromManifest,
  triggerExtraction,
  updateExtractionStatus,
} from "./steps/extract-slides";

// ============================================================================
// Main Workflow
// ============================================================================

export async function extractSlidesWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<SlideStreamEvent>();
  let currentStep = "initialization";

  const isValid = isValidYouTubeVideoId(videoId);
  if (!isValid) {
    throw new FatalError(`Invalid YouTube video ID: ${videoId}`);
  }

  try {
    currentStep = "triggering extraction";
    await emit<SlideStreamEvent>(
      {
        type: "progress",
        status: "starting",
        step: 1,
        totalSteps: 4,
        message: "Starting slide extraction...",
      },
      writable,
    );
    await triggerExtraction(videoId);

    currentStep = "monitoring job progress";
    await emit<SlideStreamEvent>(
      {
        type: "progress",
        status: "monitoring",
        step: 2,
        totalSteps: 4,
        message: "Processing video on server...",
      },
      writable,
    );
    await checkJobStatus(videoId, writable);

    currentStep = "fetching manifest";
    await emit<SlideStreamEvent>(
      {
        type: "progress",
        status: "fetching",
        step: 3,
        totalSteps: 4,
        message: "Fetching slide manifest...",
      },
      writable,
    );
    const manifest = await fetchManifest(videoId);

    currentStep = "processing slides";
    await emit<SlideStreamEvent>(
      {
        type: "progress",
        status: "saving",
        step: 4,
        totalSteps: 4,
        message: "Saving slides to database...",
      },
      writable,
    );
    const totalSlides = await processSlidesFromManifest(
      videoId,
      manifest,
      writable,
    );

    currentStep = "updating status";
    await updateExtractionStatus(videoId, "completed", totalSlides);
    await emit<SlideStreamEvent>(
      { type: "complete", totalSlides },
      writable,
      true,
    );

    return { success: true, totalSlides };
  } catch (error) {
    console.error(
      `🚀 extractSlidesWorkflow: Extract slides workflow failed at step: ${currentStep}`,
      {
        videoId,
        step: currentStep,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
        timestamp: new Date().toISOString(),
      },
    );

    const detailedMessage =
      error instanceof Error
        ? `Step "${currentStep}" failed: ${error.message}`
        : `Step "${currentStep}" failed: Unknown error occurred`;

    try {
      await updateExtractionStatus(
        videoId,
        "failed",
        undefined,
        detailedMessage,
      );
    } catch (statusError) {
      console.error(
        "🚀 extractSlidesWorkflow: Failed to update extraction status:",
        statusError,
      );
    }

    await emit<SlideStreamEvent>(
      { type: "error", message: detailedMessage },
      writable,
      true,
    );
    throw error;
  }
}
