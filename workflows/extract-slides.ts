import {
  emitComplete,
  emitError,
  emitSlide,
  processVideoLocally,
  saveSlidesToDatabase,
  updateExtractionStatus,
} from "./steps/extract-slides";

// ============================================================================
// Main Workflow - Local Processing
// ============================================================================

export async function extractSlidesWorkflow(videoId: string) {
  "use workflow";

  let currentStep = "initialization";

  try {
    currentStep = "processing video";

    // Process video locally using yt-service utilities
    const processingResult = await processVideoLocally(videoId);

    currentStep = "saving slides";

    // Save slides to database and emit each slide
    const { savedSlides, totalSlides } = await saveSlidesToDatabase(
      videoId,
      processingResult.segments,
    );

    // Emit each slide for real-time updates
    for (const slide of savedSlides) {
      await emitSlide(slide);
    }

    currentStep = "updating status";
    await updateExtractionStatus(videoId, "completed", totalSlides);
    await emitComplete(totalSlides);

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

    await emitError(detailedMessage);
    throw error;
  }
}
