"use client";

import { useCallback } from "react";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
import { consumeSSE } from "@/lib/sse";

export interface UseAnalysisStreamReturn {
  consumeAnalysisStream: (response: Response) => Promise<void>;
  resumeAnalysisStream: () => Promise<void>;
  startAnalysisRun: (additionalInstructions?: string) => Promise<void>;
}

export function useAnalysisStream(
  youtubeId: string,
  onAnalysisStateChange: React.Dispatch<React.SetStateAction<AnalysisState>>,
): UseAnalysisStreamReturn {
  // ============================================================================
  // Analysis Stream Consumption
  // ============================================================================

  const consumeAnalysisStream = useCallback(
    async (response: Response) => {
      await consumeSSE<AnalysisStreamEvent>(response, {
        progress: (event) =>
          onAnalysisStateChange((prev) => ({
            ...prev,
            phase: event.phase,
            message: event.message,
          })),
        partial: (event) =>
          onAnalysisStateChange((prev) => ({
            ...prev,
            result: event.data,
          })),
        result: (event) =>
          onAnalysisStateChange((prev) => ({
            ...prev,
            result: event.data,
          })),
        complete: (event) =>
          onAnalysisStateChange((prev) => ({
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
    },
    [onAnalysisStateChange],
  );

  // ============================================================================
  // Resume Analysis Stream
  // ============================================================================

  const resumeAnalysisStream = useCallback(async () => {
    onAnalysisStateChange({
      status: "running",
      phase: "resuming",
      message: "Reconnecting to analysis...",
      result: null,
      runId: null,
      error: null,
    });

    try {
      const response = await fetch(`/api/video/${youtubeId}/analyze/resume`);

      if (!response.ok) {
        let completed = false;
        try {
          const errorData = await response.json();
          completed = errorData.completed === true;
        } catch {
          // Ignore JSON parse errors
        }

        if (completed) {
          onAnalysisStateChange({
            status: "idle",
            phase: "",
            message: "",
            result: null,
            runId: null,
            error: null,
          });
          return;
        }
        throw new Error("Failed to resume analysis");
      }

      await consumeAnalysisStream(response);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resume analysis";

      onAnalysisStateChange((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
    }
  }, [youtubeId, consumeAnalysisStream, onAnalysisStateChange]);

  // ============================================================================
  // Start Analysis Run
  // ============================================================================

  const startAnalysisRun = useCallback(
    async (additionalInstructions?: string) => {
      onAnalysisStateChange({
        status: "running",
        phase: "starting",
        message: "Starting analysis...",
        result: null,
        runId: null,
        error: null,
      });

      try {
        const response = await fetch(`/api/video/${youtubeId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalInstructions }),
        });

        if (!response.ok) {
          throw new Error("Failed to start analysis");
        }

        await consumeAnalysisStream(response);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Analysis failed";

        onAnalysisStateChange((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    },
    [youtubeId, consumeAnalysisStream, onAnalysisStateChange],
  );

  return {
    consumeAnalysisStream,
    resumeAnalysisStream,
    startAnalysisRun,
  };
}
