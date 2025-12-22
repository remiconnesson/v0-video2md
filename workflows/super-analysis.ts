import { getWritable } from "workflow";
import { emit } from "@/lib/stream-utils";
import type { SuperAnalysisStreamEvent } from "@/lib/super-analysis-types";
import {
  checkExistingSuperAnalysis,
  getSuperAnalysisInputData,
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
