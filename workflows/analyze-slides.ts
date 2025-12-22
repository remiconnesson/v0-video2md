import { FatalError, getWritable } from "workflow";
import type {
  SlideAnalysisStreamEvent,
  SlideAnalysisTarget,
  SlideStreamId,
} from "@/lib/slides-types";
import { makeSlideStreamId } from "@/lib/slides-types";
import { emit } from "@/lib/stream-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import {
  analyzeAndSaveSlide,
  getPickedSlidesWithContext,
} from "./steps/slide-analysis";

// ============================================================================
// Main Workflow
// ============================================================================

export async function analyzeSelectedSlidesWorkflow(
  videoId: string,
  targets?: SlideAnalysisTarget[],
) {
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

    const pickedSlides = await getPickedSlidesWithContext(videoId, targets);

    if (pickedSlides.length === 0) {
      throw new FatalError("No slides selected for analysis");
    }

    // Step 2: Analyze all slides in parallel
    currentStep = "analyzing slides";
    const totalSlides = pickedSlides.length;

    // Build slide stream IDs for namespaced streams
    const slideStreamIds: SlideStreamId[] = pickedSlides.map((slide) =>
      makeSlideStreamId(slide.slideNumber, slide.framePosition),
    );

    await emit<SlideAnalysisStreamEvent>(
      {
        type: "progress",
        status: "analyzing",
        progress: 10,
        message: `Analyzing ${totalSlides} slides in parallel...`,
      },
      writable,
    );

    // Emit slides_started event so client knows which namespaced streams to subscribe to
    await emit<SlideAnalysisStreamEvent>(
      {
        type: "slides_started",
        slideStreamIds,
      },
      writable,
    );

    // Run all analyses in parallel - each step writes to its own namespaced stream
    const results = await Promise.all(
      pickedSlides.map((slideInfo) => analyzeAndSaveSlide(videoId, slideInfo)),
    );

    // Emit final results on the main stream (for backwards compatibility)
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
