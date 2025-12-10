"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
import type { SlidesState } from "@/lib/slides-types";
import { useAnalysisStream } from "./use-analysis-stream";
import { useSlidesLoader } from "./use-slides-loader";
import { useTranscriptFetch } from "./use-transcript-fetch";
import { useVideoStatus } from "./use-video-status";

// ============================================================================
// Import types for backward compatibility
// ============================================================================

import type {
  PageStatus,
  TranscriptState,
  VideoInfo,
} from "./use-transcript-fetch";
import type { AnalysisRun } from "./use-video-status";

// ============================================================================
// Re-export types for backward compatibility
// ============================================================================

export type { PageStatus, VideoInfo };
export type { AnalysisRun };

// ============================================================================
// Hook Return Type (unchanged for backward compatibility)
// ============================================================================

export interface UseVideoProcessingReturn {
  // State
  pageStatus: PageStatus;
  videoInfo: VideoInfo | null;
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  transcriptState: TranscriptState;
  analysisState: AnalysisState;
  slidesState: SlidesState;
  isAnalysisRunning: boolean;
  hasRuns: boolean;
  displayResult: unknown;

  // Actions
  handleFetchTranscript: () => void;
  handleVersionChange: (version: number) => void;
  handleStartAnalysis: () => void;
  handleReroll: (instructions: string) => void;
  setSlidesState: React.Dispatch<React.SetStateAction<SlidesState>>;
}

// ============================================================================
// Main Hook - Now orchestrates smaller hooks
// ============================================================================

export function useVideoProcessing(
  youtubeId: string,
  initialVersion?: number,
): UseVideoProcessingReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for slides (managed locally since it's simple)
  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
    slides: [],
  });

  // State for analysis (managed locally for coordination)
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  // ============================================================================
  // Initialize smaller hooks
  // ============================================================================

  const {
    checkVideoStatus: checkTranscriptStatus,
    startProcessing,
    handleFetchTranscript,
    pageStatus,
    videoInfo,
    transcriptState,
  } = useTranscriptFetch(youtubeId, setSlidesState, setAnalysisState);

  const { resumeAnalysisStream, startAnalysisRun } = useAnalysisStream(
    youtubeId,
    setAnalysisState,
  );
  const { loadExistingSlides } = useSlidesLoader(youtubeId, setSlidesState);
  const videoStatus = useVideoStatus(youtubeId, initialVersion);
  const {
    fetchRuns,
    setSelectedRun,
    handleVersionChange: handleVideoVersionChange,
  } = videoStatus;

  // ============================================================================
  // Enhanced checkVideoStatus that coordinates with other hooks
  // ============================================================================

  const checkVideoStatus = useCallback(async () => {
    const transcriptStatusResult = await checkTranscriptStatus();

    // If ready, also load runs and slides
    if (transcriptStatusResult.status === "ready") {
      const [runsResult] = await Promise.all([
        fetchRuns(),
        loadExistingSlides(),
      ]);

      if (runsResult.streamingRun?.workflowRunId) {
        transcriptStatusResult.hasStreamingAnalysis = true;
      }
    }

    return transcriptStatusResult;
  }, [checkTranscriptStatus, fetchRuns, loadExistingSlides]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status, hasStreamingAnalysis } = await checkVideoStatus();
      if (cancelled) return;

      if (status !== "ready") {
        await startProcessing();
      } else if (hasStreamingAnalysis) {
        resumeAnalysisStream();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkVideoStatus, startProcessing, resumeAnalysisStream]);

  // When analysis completes, refresh runs
  useEffect(() => {
    if (analysisState.status === "completed" && analysisState.runId) {
      fetchRuns().then(({ runs: updatedRuns }) => {
        // Select the latest run to match the new `v` param
        const latestRun = updatedRuns[updatedRuns.length - 1] ?? null;
        if (latestRun) {
          setSelectedRun(latestRun);
        }

        const params = new URLSearchParams(searchParams.toString());
        const newVersion = updatedRuns.length;
        params.set("v", newVersion.toString());
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }
  }, [
    analysisState.status,
    analysisState.runId,
    fetchRuns,
    setSelectedRun,
    router,
    searchParams,
  ]);

  // ============================================================================
  // Enhanced action handlers
  // ============================================================================

  const handleVersionChange = useCallback(
    (version: number) => {
      handleVideoVersionChange(version);
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", version.toString());
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [handleVideoVersionChange, router, searchParams],
  );

  const handleStartAnalysis = useCallback(() => {
    startAnalysisRun();
  }, [startAnalysisRun]);

  const handleReroll = useCallback(
    (instructions: string) => {
      startAnalysisRun(instructions);
    },
    [startAnalysisRun],
  );

  // ============================================================================
  // Computed State
  // ============================================================================

  const { runs, selectedRun } = videoStatus;
  const isAnalysisRunning = analysisState.status === "running";
  const hasRuns = runs.length > 0;
  const displayResult: unknown = isAnalysisRunning
    ? (analysisState.result ?? selectedRun?.result ?? null)
    : (selectedRun?.result ?? analysisState.result ?? null);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    pageStatus,
    videoInfo,
    runs,
    selectedRun,
    transcriptState,
    analysisState,
    slidesState,
    isAnalysisRunning,
    hasRuns,
    displayResult,

    // Actions
    handleFetchTranscript,
    handleVersionChange,
    handleStartAnalysis,
    handleReroll,
    setSlidesState,
  };
}
