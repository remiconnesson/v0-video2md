import { useCallback, useState } from "react";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { useSSEStream } from "@/hooks/use-sse-stream";

export type AnalysisStatus = "idle" | "running" | "completed" | "error";

export interface AnalysisState {
  status: AnalysisStatus;
  phase: string;
  message: string;
  result: unknown | null;
  runId: number | null;
  error: string | null;
}

interface UseDynamicAnalysisReturn {
  state: AnalysisState;
  startAnalysis: (additionalInstructions?: string) => Promise<void>;
  abort: () => void;
}

export function useDynamicAnalysis(videoId: string): UseDynamicAnalysisReturn {
  const { start: startSSEStream, abort: abortSSEStream } =
    useSSEStream<AnalysisStreamEvent>();

  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  const startAnalysis = useCallback(
    async (additionalInstructions?: string) => {
      // Abort any existing analysis
      abortSSEStream();

      setState({
        status: "running",
        phase: "starting",
        message: "Starting analysis...",
        result: null,
        runId: null,
        error: null,
      });

      try {
        await startSSEStream(
          `/api/video/${videoId}/analyze`,
          {
            progress: (event) =>
              setState((prev) => ({
                ...prev,
                phase: event.phase,
                message: event.message,
              })),
            partial: (event) =>
              setState((prev) => ({
                ...prev,
                result: event.data,
              })),
            result: (event) =>
              setState((prev) => ({
                ...prev,
                result: event.data,
              })),
            complete: (event) =>
              setState((prev) => ({
                ...prev,
                status: "completed",
                runId: event.runId,
                phase: "complete",
                message: "Analysis complete!",
              })),
            error: (event) => {
              throw new Error(event.message);
            },
          },
          {
            body: { additionalInstructions },
          },
        );
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Analysis failed";

        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    },
    [videoId, abortSSEStream, startSSEStream],
  );

  const abort = useCallback(() => {
    abortSSEStream();
  }, [abortSSEStream]);

  return {
    state,
    startAnalysis,
    abort,
  };
}
