import { FatalError, getWritable } from "workflow";
import type { SlideAnalysisStreamEvent } from "@/lib/slides-types";
import { emit } from "@/lib/stream-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import {
  analyzePickedSlide,
  getPickedSlidesWithContext,
  saveSlideAnalysis,
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

    // Step 2: Analyze each slide
    currentStep = "analyzing slides";
    const totalSlides = pickedSlides.length;
    let analyzedCount = 0;

    for (const slideInfo of pickedSlides) {
      await emit<SlideAnalysisStreamEvent>(
        {
          type: "progress",
          status: "analyzing",
          progress: Math.round((analyzedCount / totalSlides) * 100),
          message: `Analyzing slide ${slideInfo.slideNumber} (${slideInfo.framePosition} frame)...`,
        },
        writable,
      );

      const markdown = await analyzePickedSlide(slideInfo);

      // Save to database
      await saveSlideAnalysis(
        videoId,
        slideInfo.slideNumber,
        slideInfo.framePosition,
        markdown,
      );

      // Emit the result
      await emit<SlideAnalysisStreamEvent>(
        {
          type: "slide_markdown",
          slideNumber: slideInfo.slideNumber,
          framePosition: slideInfo.framePosition,
          markdown,
        },
        writable,
      );

      analyzedCount++;
    }

    // Step 3: Complete
    currentStep = "completing";
    await emit<SlideAnalysisStreamEvent>(
      { type: "complete", totalSlides: analyzedCount },
      writable,
      true,
    );

    return { success: true, analyzedCount };
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
