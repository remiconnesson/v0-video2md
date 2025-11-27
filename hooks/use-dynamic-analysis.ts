import { useCallback, useRef, useState } from "react";
import type { GodPromptOutput } from "@/ai/dynamic-analysis-schema";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";

export type AnalysisStatus = "idle" | "running" | "completed" | "error";

export interface AnalysisState {
  status: AnalysisStatus;
  phase: string;
  message: string;
  result: GodPromptOutput | null;
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

        if (!response.ok || !response.body) {
          throw new Error("Failed to start analysis");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: AnalysisStreamEvent = JSON.parse(line.slice(6));

                if (event.type === "progress") {
                  setState((prev) => ({
                    ...prev,
                    phase: event.phase,
                    message: event.message,
                  }));
                } else if (event.type === "result") {
                  setState((prev) => ({
                    ...prev,
                    result: event.data,
                  }));
                } else if (event.type === "complete") {
                  setState((prev) => ({
                    ...prev,
                    status: "completed",
                    runId: event.runId,
                    phase: "complete",
                    message: "Analysis complete!",
                  }));
                } else if (event.type === "error") {
                  throw new Error(event.message);
                }
              } catch (parseError) {
                if (parseError instanceof SyntaxError) {
                  // Ignore malformed SSE lines
                } else {
                  throw parseError;
                }
              }
            }
          }
        }
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
