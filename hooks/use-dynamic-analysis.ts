import { useCallback, useRef, useState } from "react";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { consumeSSE } from "@/lib/sse";

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
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(
    async (additionalInstructions?: string) => {
      // Abort any existing analysis
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState({
        status: "running",
        phase: "starting",
        message: "Starting analysis...",
        result: null,
        runId: null,
        error: null,
      });

      try {
        const response = await fetch(`/api/video/${videoId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalInstructions }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to start analysis");
        }

        await consumeSSE<AnalysisStreamEvent>(response, {
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
        });
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
    [videoId],
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    state,
    startAnalysis,
    abort,
  };
}
