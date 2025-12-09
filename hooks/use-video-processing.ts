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
// Re-export types for backward compatibility
// ============================================================================

export type { PageStatus, VideoInfo };
export type { AnalysisRun };

// ============================================================================
// Import types for backward compatibility
// ============================================================================

import type { PageStatus, VideoInfo } from "./use-transcript-fetch";
import type { AnalysisRun } from "./use-video-status";

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

type TranscriptState = {
  status: "idle" | "fetching" | "completed" | "error";
  progress: number;
  message: string;
  error: string | null;
};

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

  const transcriptFetch = useTranscriptFetch(
    youtubeId,
    setSlidesState,
    setAnalysisState,
  );

  const analysisStream = useAnalysisStream(youtubeId, setAnalysisState);
  const slidesLoader = useSlidesLoader(youtubeId, setSlidesState);
  const videoStatus = useVideoStatus(youtubeId, initialVersion);

  // ============================================================================
  // Enhanced checkVideoStatus that coordinates with other hooks
  // ============================================================================

  const checkVideoStatus = useCallback(async () => {
    const result = await transcriptFetch.checkVideoStatus();

    // If ready, also load runs and slides
    if (result.status === "ready") {
      const [runsResult] = await Promise.all([
        videoStatus.fetchRuns(),
        slidesLoader.loadExistingSlides(),
      ]);

      if (runsResult.streamingRun?.workflowRunId) {
        result.hasStreamingAnalysis = true;
      }
    }

    return result;
  }, [transcriptFetch, videoStatus, slidesLoader]);

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
        transcriptFetch.startProcessing();
      } else if (hasStreamingAnalysis) {
        analysisStream.resumeAnalysisStream();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkVideoStatus, transcriptFetch, analysisStream]);

  // When analysis completes, refresh runs
  useEffect(() => {
    if (analysisState.status === "completed" && analysisState.runId) {
      videoStatus.fetchRuns().then(({ runs: updatedRuns }) => {
        const params = new URLSearchParams(searchParams.toString());
        const newVersion = updatedRuns.length;
        params.set("v", newVersion.toString());
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }
  }, [
    analysisState.status,
    analysisState.runId,
    videoStatus,
    router,
    searchParams,
  ]);

  // ============================================================================
  // Enhanced action handlers
  // ============================================================================

  const handleVersionChange = useCallback(
    (version: number) => {
      videoStatus.handleVersionChange(version);
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", version.toString());
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [videoStatus, router, searchParams],
  );

  const handleStartAnalysis = useCallback(() => {
    analysisStream.startAnalysisRun();
  }, [analysisStream]);

  const handleReroll = useCallback(
    (instructions: string) => {
      analysisStream.startAnalysisRun(instructions);
    },
    [analysisStream],
  );

  // ============================================================================
  // Computed State
  // ============================================================================

  const isAnalysisRunning = analysisState.status === "running";
  const hasRuns = videoStatus.runs.length > 0;
  const displayResult: unknown = isAnalysisRunning
    ? analysisState.result
    : (videoStatus.selectedRun?.result ?? null);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    pageStatus: transcriptFetch.pageStatus,
    videoInfo: transcriptFetch.videoInfo,
    runs: videoStatus.runs,
    selectedRun: videoStatus.selectedRun,
    transcriptState: transcriptFetch.transcriptState,
    analysisState,
    slidesState,
    isAnalysisRunning,
    hasRuns,
    displayResult,

    // Actions
    handleFetchTranscript: transcriptFetch.handleFetchTranscript,
    handleVersionChange,
    handleStartAnalysis,
    handleReroll,
    setSlidesState,
  };
}
