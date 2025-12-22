import { FatalError, getWritable } from "workflow";
import type { SlideAnalysisStreamEvent } from "@/lib/slides-types";
import { emit } from "@/lib/stream-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import {
  analyzeAndSaveSlide,
  getPickedSlidesWithContext,
} from "./steps/slide-analysis";

// ============================================================================
// Main Workflow
// ============================================================================

export async function analyzeSelectedSlidesWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<SlideAnalysisStreamEvent>();
  let currentStep = "initialization";

  const isValid = isValidYouTubeVideoId(videoId);
  if (!isValid) {
    throw new FatalError(`Invalid YouTube video ID: ${videoId}`);
  }

  try {
    // Step 1: Get picked slides with transcript context
    currentStep = "fetching picked slides";
    await emit<SlideAnalysisStreamEvent>(
      {
        type: "progress",
        status: "loading",
        progress: 0,
        message: "Loading selected slides...",
      },
      writable,
    );

    const pickedSlides = await getPickedSlidesWithContext(videoId);

    if (pickedSlides.length === 0) {
      throw new FatalError("No slides selected for analysis");
    }

    // Step 2: Analyze all slides in parallel
    currentStep = "analyzing slides";
    const totalSlides = pickedSlides.length;

    await emit<SlideAnalysisStreamEvent>(
      {
        type: "progress",
        status: "analyzing",
        progress: 10,
        message: `Analyzing ${totalSlides} slides in parallel...`,
      },
      writable,
    );

    // Run all analyses in parallel
    const results = await Promise.all(
      pickedSlides.map((slideInfo) => analyzeAndSaveSlide(videoId, slideInfo)),
    );

    // Emit all results
    for (const result of results) {
      await emit<SlideAnalysisStreamEvent>(
        {
          type: "slide_markdown",
          slideNumber: result.slideNumber,
          framePosition: result.framePosition,
          markdown: result.markdown,
        },
        writable,
      );
    }

    // Step 3: Complete
    currentStep = "completing";
    await emit<SlideAnalysisStreamEvent>(
      { type: "complete", totalSlides: results.length },
      writable,
      true,
    );

    return { success: true, analyzedCount: results.length };
  } catch (error) {
    console.error(
      `analyzeSelectedSlidesWorkflow: Failed at step: ${currentStep}`,
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

    await emit<SlideAnalysisStreamEvent>(
      { type: "error", message: detailedMessage },
      writable,
      true,
    );

    throw error;
  }
}
