"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { consumeSSE } from "@/lib/sse";

// ============================================================================
// Types
// ============================================================================

export type PageStatus = "loading" | "ready" | "error";

export interface TranscriptInfo {
  id: string;
  title: string;
  description: string | null;
  source: string | null;
  author: string | null;
  additional_comments: string | null;
  created_at: string;
}

export interface AnalysisRun {
  id: number;
  version: number;
  status: string;
  result: unknown;
  workflowRunId: string | null;
  additionalInstructions: string | null;
  createdAt: string;
}

export interface AnalysisState {
  status: "idle" | "streaming" | "completed" | "error";
  phase: string;
  message: string;
  result: unknown;
  runId: number | null;
  error: string | null;
}

// ============================================================================
// Hook Return Type
// ============================================================================

export interface UseExternalTranscriptProcessingReturn {
  // State
  pageStatus: PageStatus;
  transcriptInfo: TranscriptInfo | null;
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  analysisState: AnalysisState;
  isAnalysisRunning: boolean;
  hasRuns: boolean;
  displayResult: unknown;

  // Actions
  handleVersionChange: (version: number) => void;
  handleStartAnalysis: () => void;
  handleReroll: (instructions: string) => void;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useExternalTranscriptProcessing(
  transcriptId: string,
  initialVersion?: number,
): UseExternalTranscriptProcessingReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [transcriptInfo, setTranscriptInfo] = useState<TranscriptInfo | null>(
    null,
  );
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  // ============================================================================
  // Fetch transcript info
  // ============================================================================

  const fetchTranscriptInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/transcript/${transcriptId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch transcript");
      }
      const data = await response.json();
      setTranscriptInfo(data);
    } catch (error) {
      console.error("Failed to fetch transcript:", error);
      setPageStatus("error");
    }
  }, [transcriptId]);

  // ============================================================================
  // Fetch analysis runs
  // ============================================================================

  const fetchRuns = useCallback(async () => {
    try {
      const response = await fetch(`/api/transcript/${transcriptId}/analyze`);
      if (!response.ok) {
        throw new Error("Failed to fetch runs");
      }
      const data = await response.json();
      setRuns(data.runs);

      // Set selected run based on version or latest
      if (initialVersion) {
        const run = data.runs.find(
          (r: AnalysisRun) => r.version === initialVersion,
        );
        if (run) setSelectedRun(run);
      } else if (data.runs.length > 0) {
        setSelectedRun(data.runs[0]);
      }

      return data;
    } catch (error) {
      console.error("Failed to fetch runs:", error);
      return { runs: [], streamingRun: null };
    }
  }, [transcriptId, initialVersion]);

  // ============================================================================
  // Start analysis
  // ============================================================================

  const startAnalysis = useCallback(
    async (additionalInstructions?: string) => {
      setAnalysisState({
        status: "streaming",
        phase: "starting",
        message: "Starting analysis...",
        result: null,
        runId: null,
        error: null,
      });

      try {
        const response = await fetch(
          `/api/transcript/${transcriptId}/analyze`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              additionalInstructions,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Failed to start analysis");
        }

        await consumeSSE(response, {
          progress: (event) => {
            setAnalysisState((prev) => ({
              ...prev,
              status: "streaming",
              phase: event.phase,
              message: event.message,
            }));
          },
          partial: (event) => {
            setAnalysisState((prev) => ({
              ...prev,
              status: "streaming",
              result: event.data,
            }));
          },
          result: (event) => {
            setAnalysisState((prev) => ({
              ...prev,
              result: event.data,
            }));
          },
          complete: (event) => {
            setAnalysisState((prev) => ({
              ...prev,
              status: "completed",
              runId: event.runId,
            }));
          },
          error: (event) => {
            setAnalysisState({
              status: "error",
              phase: "",
              message: "",
              result: null,
              runId: null,
              error: event.message,
            });
          },
        });
      } catch (error) {
        setAnalysisState({
          status: "error",
          phase: "",
          message: "",
          result: null,
          runId: null,
          error: error instanceof Error ? error.message : "Analysis failed",
        });
      }
    },
    [transcriptId],
  );

  // ============================================================================
  // Resume streaming analysis
  // ============================================================================

  const resumeAnalysis = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/transcript/${transcriptId}/analyze/resume`,
      );

      if (!response.ok) {
        console.log("No streaming analysis to resume");
        return;
      }

      setAnalysisState({
        status: "streaming",
        phase: "resuming",
        message: "Resuming analysis...",
        result: null,
        runId: null,
        error: null,
      });

      await consumeSSE(response, {
        progress: (event) => {
          setAnalysisState((prev) => ({
            ...prev,
            status: "streaming",
            phase: event.phase,
            message: event.message,
          }));
        },
        partial: (event) => {
          setAnalysisState((prev) => ({
            ...prev,
            status: "streaming",
            result: event.data,
          }));
        },
        result: (event) => {
          setAnalysisState((prev) => ({
            ...prev,
            result: event.data,
          }));
        },
        complete: (event) => {
          setAnalysisState((prev) => ({
            ...prev,
            status: "completed",
            runId: event.runId,
          }));
        },
        error: (event) => {
          setAnalysisState({
            status: "error",
            phase: "",
            message: "",
            result: null,
            runId: null,
            error: event.message,
          });
        },
      });
    } catch (error) {
      console.error("Failed to resume analysis:", error);
    }
  }, [transcriptId]);

  // ============================================================================
  // Initial load
  // ============================================================================

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await fetchTranscriptInfo();
      if (cancelled) return;

      const data = await fetchRuns();
      if (cancelled) return;

      setPageStatus("ready");

      // Resume streaming if there's an active run
      if (data.streamingRun?.workflowRunId) {
        resumeAnalysis();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchTranscriptInfo, fetchRuns, resumeAnalysis]);

  // ============================================================================
  // When analysis completes, refresh runs
  // ============================================================================

  useEffect(() => {
    if (analysisState.status === "completed" && analysisState.runId) {
      fetchRuns().then((data) => {
        const latestRun = data.runs[0] ?? null;
        if (latestRun) {
          setSelectedRun(latestRun);
          const params = new URLSearchParams(searchParams.toString());
          params.set("v", latestRun.version.toString());
          router.push(`?${params.toString()}`, { scroll: false });
        }
      });
    }
  }, [
    analysisState.status,
    analysisState.runId,
    fetchRuns,
    router,
    searchParams,
  ]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleVersionChange = useCallback(
    (version: number) => {
      const run = runs.find((r) => r.version === version);
      if (run) {
        setSelectedRun(run);
        const params = new URLSearchParams(searchParams.toString());
        params.set("v", version.toString());
        router.push(`?${params.toString()}`, { scroll: false });
      }
    },
    [runs, router, searchParams],
  );

  const handleStartAnalysis = useCallback(() => {
    startAnalysis();
  }, [startAnalysis]);

  const handleReroll = useCallback(
    (instructions: string) => {
      startAnalysis(instructions);
    },
    [startAnalysis],
  );

  // ============================================================================
  // Computed values
  // ============================================================================

  const isAnalysisRunning = analysisState.status === "streaming";
  const hasRuns = runs.length > 0;
  const displayResult =
    analysisState.status === "streaming" || analysisState.status === "completed"
      ? analysisState.result
      : (selectedRun?.result ?? null);

  return {
    pageStatus,
    transcriptInfo,
    runs,
    selectedRun,
    analysisState,
    isAnalysisRunning,
    hasRuns,
    displayResult,
    handleVersionChange,
    handleStartAnalysis,
    handleReroll,
  };
}
