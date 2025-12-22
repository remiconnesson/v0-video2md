import { getWritable } from "workflow";
import { emit } from "@/lib/stream-utils";
import type {
  SlideAnalysisProgress,
  SuperAnalysisStreamEvent,
} from "@/lib/super-analysis-types";
import {
  checkExistingSuperAnalysis,
  createInitialSlideProgress,
  getExistingSlideAnalysisResults,
  getPickedSlidesForSuperAnalysis,
  getSuperAnalysisInputData,
  runSingleSlideAnalysis,
  runSuperAnalysisStep,
  saveSuperAnalysisResultStep,
} from "@/workflows/steps/super-analysis";

export async function superAnalysisWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<SuperAnalysisStreamEvent>();

  try {
    const existingAnalysis = await checkExistingSuperAnalysis(videoId);
    if (existingAnalysis?.result) {
      await emit<SuperAnalysisStreamEvent>(
        { type: "result", data: existingAnalysis.result },
        writable,
        true,
      );
      return { success: true, usedCache: true };
    }

    // Phase 1: Load picked slides and check existing analysis results
    await emit<SuperAnalysisStreamEvent>(
      {
        type: "progress",
        phase: "loading",
        message: "Loading selected slides...",
      },
      writable,
    );

    const pickedSlides = await getPickedSlidesForSuperAnalysis(videoId);

    if (pickedSlides.length === 0) {
      throw new Error(
        "No slides selected for analysis. Please pick some slides first.",
      );
    }

    const existingResults = await getExistingSlideAnalysisResults(videoId);
    const slideProgress = createInitialSlideProgress(
      pickedSlides,
      existingResults,
    );

    // Count how many slides need to be analyzed
    const slidesNeedingAnalysis = slideProgress.filter(
      (s) => s.status === "pending",
    );
    const alreadyCompletedCount = slideProgress.filter(
      (s) => s.status === "completed",
    ).length;

    // Emit initial slide analysis progress
    await emit<SuperAnalysisStreamEvent>(
      {
        type: "slide_analysis_progress",
        slides: slideProgress,
        completedCount: alreadyCompletedCount,
        totalCount: pickedSlides.length,
      },
      writable,
    );

    // Phase 2: Run slide analysis for slides that don't have results
    if (slidesNeedingAnalysis.length > 0) {
      await emit<SuperAnalysisStreamEvent>(
        {
          type: "progress",
          phase: "slide_analysis",
          message: `Analyzing ${slidesNeedingAnalysis.length} slide(s)...`,
        },
        writable,
      );

      // Process slides in parallel but update progress as each completes
      const slideProgressMap = new Map<string, SlideAnalysisProgress>(
        slideProgress.map((s) => [`${s.slideNumber}-${s.framePosition}`, s]),
      );

      // Mark all pending slides as analyzing
      for (const slide of slidesNeedingAnalysis) {
        const key = `${slide.slideNumber}-${slide.framePosition}`;
        slideProgressMap.set(key, { ...slide, status: "analyzing" });
      }

      await emit<SuperAnalysisStreamEvent>(
        {
          type: "slide_analysis_progress",
          slides: Array.from(slideProgressMap.values()),
          completedCount: alreadyCompletedCount,
          totalCount: pickedSlides.length,
        },
        writable,
      );

      // Run all slide analyses in parallel
      const slideAnalysisPromises = slidesNeedingAnalysis.map(
        async (slideStatus) => {
          const slideInfo = pickedSlides.find(
            (s) =>
              s.slideNumber === slideStatus.slideNumber &&
              s.framePosition === slideStatus.framePosition,
          );

          if (!slideInfo) {
            return {
              ...slideStatus,
              status: "failed" as const,
              error: "Slide info not found",
            };
          }

          try {
            await runSingleSlideAnalysis(videoId, slideInfo);
            return { ...slideStatus, status: "completed" as const };
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : "Unknown error";
            return {
              ...slideStatus,
              status: "failed" as const,
              error: errorMsg,
            };
          }
        },
      );

      const analysisResults = await Promise.all(slideAnalysisPromises);

      // Update progress with final results
      for (const result of analysisResults) {
        const key = `${result.slideNumber}-${result.framePosition}`;
        slideProgressMap.set(key, result);
      }

      const finalSlideProgress = Array.from(slideProgressMap.values());
      const finalCompletedCount = finalSlideProgress.filter(
        (s) => s.status === "completed",
      ).length;
      const failedCount = finalSlideProgress.filter(
        (s) => s.status === "failed",
      ).length;

      await emit<SuperAnalysisStreamEvent>(
        {
          type: "slide_analysis_progress",
          slides: finalSlideProgress,
          completedCount: finalCompletedCount,
          totalCount: pickedSlides.length,
        },
        writable,
      );

      if (failedCount > 0 && finalCompletedCount === 0) {
        throw new Error("All slide analyses failed. Please try again.");
      }
    }

    // Phase 3: Generate super analysis synthesis
    await emit<SuperAnalysisStreamEvent>(
      {
        type: "progress",
        phase: "loading",
        message: "Loading transcript, slides, and analysis context...",
      },
      writable,
    );

    const inputData = await getSuperAnalysisInputData(videoId);

    await emit<SuperAnalysisStreamEvent>(
      {
        type: "progress",
        phase: "analyzing",
        message: "Synthesizing unified report...",
      },
      writable,
    );

    const finalResult = await runSuperAnalysisStep(inputData, writable);

    await saveSuperAnalysisResultStep(videoId, finalResult);

    await emit<SuperAnalysisStreamEvent>(
      { type: "result", data: finalResult },
      writable,
      true,
    );

    return { success: true, usedCache: false };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate super analysis";

    await emit<SuperAnalysisStreamEvent>(
      { type: "error", message },
      writable,
      true,
    );

    throw error;
  }
}
