"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ProcessingStreamEvent } from "@/app/api/video/[videoId]/process/route";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import type { SlideData, SlidesState } from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";

// ============================================================================
// Types
// ============================================================================

export type PageStatus =
  | "loading"
  | "no_transcript"
  | "fetching_transcript"
  | "ready";

export interface VideoInfo {
  title: string;
  channelName?: string;
  thumbnail?: string;
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

export interface TranscriptState {
  status: "idle" | "fetching" | "completed" | "error";
  progress: number;
  message: string;
  error: string | null;
}

export interface AnalysisState {
  status: "idle" | "running" | "completed" | "error";
  phase: string;
  message: string;
  result: unknown | null;
  runId: number | null;
  error: string | null;
}

// ============================================================================
// Internal State
// ============================================================================

type Status = "loading" | "no_video" | "processing" | "ready" | "error";

interface State {
  status: Status;
  video: VideoInfo | null;
  runs: AnalysisRun[];
  selectedRunId: number | null;
  processingProgress: {
    phase: "fetching" | "analyzing" | "saving";
    message: string;
    progress: number;
  } | null;
  analysisProgress: {
    phase: string;
    message: string;
    partial: unknown | null;
  } | null;
  slides: SlideData[];
  slidesProgress: {
    progress: number;
    message: string;
  } | null;
  error: string | null;
}

const initialState: State = {
  status: "loading",
  video: null,
  runs: [],
  selectedRunId: null,
  processingProgress: null,
  analysisProgress: null,
  slides: [],
  slidesProgress: null,
  error: null,
};

// ============================================================================
// Actions
// ============================================================================

type Action =
  // Initialization
  | { type: "INIT_START" }
  | { type: "INIT_NOT_FOUND" }
  | {
      type: "INIT_READY";
      video: VideoInfo;
      runs: AnalysisRun[];
      slides: SlideData[];
      selectedRunId: number | null;
    }
  // Processing (transcript + analysis via /process)
  | { type: "PROCESS_START" }
  | { type: "PROCESS_TRANSCRIPT_PROGRESS"; progress: number; message: string }
  | { type: "PROCESS_ANALYSIS_PROGRESS"; phase: string; message: string }
  | { type: "PROCESS_ANALYSIS_PARTIAL"; data: unknown }
  | { type: "PROCESS_COMPLETE"; video: VideoInfo; runId: number }
  // Standalone analysis (re-runs via /analyze)
  | { type: "ANALYSIS_START" }
  | { type: "ANALYSIS_PROGRESS"; phase: string; message: string }
  | { type: "ANALYSIS_PARTIAL"; data: unknown }
  | { type: "ANALYSIS_COMPLETE"; runId: number }
  // Slides
  | { type: "SLIDE_RECEIVED"; slide: SlideData }
  | { type: "SLIDES_PROGRESS"; progress: number; message: string }
  | { type: "SLIDES_COMPLETE"; totalSlides: number }
  // Version selection
  | { type: "SELECT_RUN"; runId: number }
  | { type: "RUNS_REFRESHED"; runs: AnalysisRun[]; selectRunId?: number }
  // Slides state (for backward compat with setSlidesState)
  | { type: "SET_SLIDES_STATE"; slides: SlideData[]; status?: string }
  // Errors
  | {
      type: "ERROR";
      error: string;
      source?: "process" | "analysis" | "slides";
    };

// ============================================================================
// Reducer
// ============================================================================

export function videoProcessingReducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT_START":
      return { ...initialState, status: "loading" };

    case "INIT_NOT_FOUND":
      return { ...state, status: "no_video" };

    case "INIT_READY":
      return {
        ...state,
        status: "ready",
        video: action.video,
        runs: action.runs,
        slides: action.slides,
        selectedRunId: action.selectedRunId,
      };

    case "PROCESS_START":
      return {
        ...state,
        status: "processing",
        processingProgress: {
          phase: "fetching",
          message: "Connecting to YouTube...",
          progress: 10,
        },
        slidesProgress: {
          progress: 0,
          message: "Starting slides extraction...",
        },
        slides: [],
        error: null,
      };

    case "PROCESS_TRANSCRIPT_PROGRESS":
      return {
        ...state,
        processingProgress: {
          phase: "fetching",
          message: action.message,
          progress: action.progress,
        },
      };

    case "PROCESS_ANALYSIS_PROGRESS":
      return {
        ...state,
        processingProgress: {
          phase: "analyzing",
          message: action.message,
          progress: state.processingProgress?.progress ?? 50,
        },
        analysisProgress: {
          phase: action.phase,
          message: action.message,
          partial: state.analysisProgress?.partial ?? null,
        },
      };

    case "PROCESS_ANALYSIS_PARTIAL":
      return {
        ...state,
        analysisProgress: state.analysisProgress
          ? { ...state.analysisProgress, partial: action.data }
          : { phase: "analyzing", message: "", partial: action.data },
      };

    case "PROCESS_COMPLETE":
      return {
        ...state,
        status: "ready",
        video: action.video,
        processingProgress: null,
        analysisProgress: null,
        // Run will be added via RUNS_REFRESHED
      };

    case "ANALYSIS_START":
      return {
        ...state,
        analysisProgress: {
          phase: "starting",
          message: "Starting analysis...",
          partial: null,
        },
        error: null,
      };

    case "ANALYSIS_PROGRESS":
      return {
        ...state,
        analysisProgress: {
          phase: action.phase,
          message: action.message,
          partial: state.analysisProgress?.partial ?? null,
        },
      };

    case "ANALYSIS_PARTIAL":
      return {
        ...state,
        analysisProgress: state.analysisProgress
          ? { ...state.analysisProgress, partial: action.data }
          : { phase: "analyzing", message: "", partial: action.data },
      };

    case "ANALYSIS_COMPLETE":
      return {
        ...state,
        analysisProgress: null,
        // selectedRunId will be set via RUNS_REFRESHED
      };

    case "SLIDE_RECEIVED":
      return {
        ...state,
        slides: [...state.slides, action.slide],
      };

    case "SLIDES_PROGRESS":
      return {
        ...state,
        slidesProgress: {
          progress: action.progress,
          message: action.message,
        },
      };

    case "SLIDES_COMPLETE":
      return {
        ...state,
        slidesProgress: null,
      };

    case "SELECT_RUN":
      return {
        ...state,
        selectedRunId: action.runId,
      };

    case "RUNS_REFRESHED":
      return {
        ...state,
        runs: action.runs,
        selectedRunId: action.selectRunId ?? state.selectedRunId,
      };

    case "SET_SLIDES_STATE":
      return {
        ...state,
        slides: action.slides,
      };

    case "ERROR":
      if (action.source === "slides") {
        return {
          ...state,
          slidesProgress: null,
          error: action.error,
        };
      }
      return {
        ...state,
        status: state.status === "processing" ? "error" : state.status,
        processingProgress: null,
        analysisProgress: null,
        error: action.error,
      };

    default:
      return state;
  }
}

// ============================================================================
// Return Type
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
// Hook
// ============================================================================

export function useVideoProcessing(
  youtubeId: string,
  initialVersion?: number,
): UseVideoProcessingReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(videoProcessingReducer, initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================================================
  // API Functions
  // ============================================================================

  // Use a ref for refreshRuns to avoid circular dependency issues
  const refreshRunsRef = useRef<(selectRunId?: number) => Promise<void>>(
    null,
  ) as React.RefObject<((selectRunId?: number) => Promise<void>) | null>;

  const refreshRuns = useCallback(
    async (selectRunId?: number) => {
      try {
        const response = await fetch(`/api/video/${youtubeId}/analyze`);
        if (!response.ok) return;

        const data = await response.json();
        const runs = data.runs as AnalysisRun[];

        // If selectRunId provided, use it; otherwise select latest
        const runIdToSelect = selectRunId ?? runs[runs.length - 1]?.id ?? null;

        dispatch({
          type: "RUNS_REFRESHED",
          runs,
          selectRunId: runIdToSelect,
        });

        // Update URL
        if (runIdToSelect) {
          const run = runs.find((r) => r.id === runIdToSelect);
          if (run) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("v", run.version.toString());
            router.push(`?${params.toString()}`, { scroll: false });
          }
        }
      } catch (err) {
        console.error("Failed to refresh runs:", err);
      }
    },
    [youtubeId, router, searchParams],
  );

  // Keep ref in sync
  refreshRunsRef.current = refreshRuns;

  const startProcessing = useCallback(
    async (signal: AbortSignal) => {
      dispatch({ type: "PROCESS_START" });

      try {
        const response = await fetch(`/api/video/${youtubeId}/process`, {
          method: "POST",
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to start processing");
        }

        await consumeSSE<ProcessingStreamEvent>(response, {
          progress: (e) => {
            if (e.source === "unified") {
              if (e.phase === "fetching") {
                dispatch({
                  type: "PROCESS_TRANSCRIPT_PROGRESS",
                  progress: e.progress ?? 0,
                  message: e.message ?? "",
                });
              } else {
                dispatch({
                  type: "PROCESS_ANALYSIS_PROGRESS",
                  phase: e.phase,
                  message: e.message ?? "",
                });
              }
            } else if (e.source === "slides") {
              dispatch({
                type: "SLIDES_PROGRESS",
                progress: e.progress ?? 0,
                message: e.message ?? "",
              });
            }
          },
          partial: (e) => {
            if (e.source === "unified") {
              dispatch({ type: "PROCESS_ANALYSIS_PARTIAL", data: e.data });
            }
          },
          result: (e) => {
            if (e.source === "unified") {
              dispatch({ type: "PROCESS_ANALYSIS_PARTIAL", data: e.data });
            }
          },
          slide: (e) => {
            if (e.source === "slides") {
              dispatch({ type: "SLIDE_RECEIVED", slide: e.slide });
            }
          },
          complete: (e) => {
            if (e.source === "unified") {
              dispatch({
                type: "PROCESS_COMPLETE",
                video: {
                  title: e.video.title,
                  channelName: e.video.channelName,
                },
                runId: e.runId,
              });
              // Refresh runs to get the new run
              refreshRunsRef.current?.(e.runId);
            } else if (e.source === "slides") {
              dispatch({ type: "SLIDES_COMPLETE", totalSlides: e.totalSlides });
            }
          },
          error: (e) => {
            const errorMessage = "error" in e ? e.error : e.message;
            dispatch({
              type: "ERROR",
              error: errorMessage ?? "Unknown error",
              source: e.source as "process" | "analysis" | "slides",
            });
          },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          error: err instanceof Error ? err.message : "Processing failed",
          source: "process",
        });
      }
    },
    [youtubeId],
  );

  const startAnalysis = useCallback(
    async (additionalInstructions?: string) => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      dispatch({ type: "ANALYSIS_START" });

      try {
        const response = await fetch(`/api/video/${youtubeId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalInstructions }),
          signal,
        });

        if (!response.ok) {
          throw new Error("Failed to start analysis");
        }

        await consumeSSE<AnalysisStreamEvent>(response, {
          progress: (e) => {
            dispatch({
              type: "ANALYSIS_PROGRESS",
              phase: e.phase,
              message: e.message,
            });
          },
          partial: (e) => {
            dispatch({ type: "ANALYSIS_PARTIAL", data: e.data });
          },
          result: (e) => {
            dispatch({ type: "ANALYSIS_PARTIAL", data: e.data });
          },
          complete: (e) => {
            dispatch({ type: "ANALYSIS_COMPLETE", runId: e.runId });
            refreshRunsRef.current?.(e.runId);
          },
          error: (e) => {
            dispatch({
              type: "ERROR",
              error: e.message,
              source: "analysis",
            });
          },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          error: err instanceof Error ? err.message : "Analysis failed",
          source: "analysis",
        });
      }
    },
    [youtubeId],
  );

  const resumeAnalysisStream = useCallback(
    async (signal: AbortSignal) => {
      dispatch({ type: "ANALYSIS_START" });

      try {
        const response = await fetch(`/api/video/${youtubeId}/analyze/resume`, {
          signal,
        });

        if (!response.ok) {
          // Check if analysis completed while we were trying to resume
          try {
            const data = await response.json();
            if (data.completed) {
              dispatch({ type: "ANALYSIS_COMPLETE", runId: 0 });
              refreshRunsRef.current?.();
              return;
            }
          } catch {
            // Ignore JSON parse errors
          }
          throw new Error("Failed to resume analysis");
        }

        await consumeSSE<AnalysisStreamEvent>(response, {
          progress: (e) => {
            dispatch({
              type: "ANALYSIS_PROGRESS",
              phase: e.phase,
              message: e.message,
            });
          },
          partial: (e) => {
            dispatch({ type: "ANALYSIS_PARTIAL", data: e.data });
          },
          result: (e) => {
            dispatch({ type: "ANALYSIS_PARTIAL", data: e.data });
          },
          complete: (e) => {
            dispatch({ type: "ANALYSIS_COMPLETE", runId: e.runId });
            refreshRunsRef.current?.(e.runId);
          },
          error: (e) => {
            dispatch({
              type: "ERROR",
              error: e.message,
              source: "analysis",
            });
          },
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silent fail for resume - user can manually retry
        console.error("Failed to resume analysis:", err);
      }
    },
    [youtubeId],
  );

  // ============================================================================
  // Initialization Effect
  // ============================================================================

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function init() {
      dispatch({ type: "INIT_START" });

      try {
        // Check video status
        const videoRes = await fetch(`/api/video/${youtubeId}`, {
          signal: controller.signal,
        });

        if (!videoRes.ok) {
          dispatch({ type: "INIT_NOT_FOUND" });
          return;
        }

        const videoData = await videoRes.json();

        if (videoData.status === "not_found") {
          dispatch({ type: "INIT_NOT_FOUND" });
          return;
        }

        if (videoData.status === "processing") {
          // Video exists but still processing - start processing
          await startProcessing(controller.signal);
          return;
        }

        // Video ready - fetch runs and slides in parallel
        const [runsRes, slidesRes] = await Promise.all([
          fetch(`/api/video/${youtubeId}/analyze`, {
            signal: controller.signal,
          }),
          fetch(`/api/video/${youtubeId}/slides`, {
            signal: controller.signal,
          }),
        ]);

        const runsData = await runsRes.json();
        const slidesData = await slidesRes.json();

        // Determine which run to select
        let selectedRunId: number | null = null;
        if (runsData.runs?.length > 0) {
          if (initialVersion) {
            const matchingRun = runsData.runs.find(
              (r: AnalysisRun) => r.version === initialVersion,
            );
            selectedRunId = matchingRun?.id ?? runsData.runs[0].id;
          } else {
            // Select latest (run with highest ID, regardless of array order)
            selectedRunId =
              runsData.runs.reduce(
                (maxId: number, run: AnalysisRun) =>
                  run.id > maxId ? run.id : maxId,
                runsData.runs[0]?.id ?? 0,
              ) ?? null;
          }
        }

        dispatch({
          type: "INIT_READY",
          video: videoData.video ?? { title: "Video" },
          runs: runsData.runs ?? [],
          slides: slidesData.slides ?? [],
          selectedRunId,
        });

        // Resume streaming analysis if one exists
        if (runsData.streamingRun?.workflowRunId) {
          resumeAnalysisStream(controller.signal);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          error: err instanceof Error ? err.message : "Initialization failed",
        });
      }
    }

    init();

    return () => {
      controller.abort();
    };
  }, [youtubeId, initialVersion, startProcessing, resumeAnalysisStream]);

  // ============================================================================
  // Derived State (backward compatibility)
  // ============================================================================

  const pageStatus: PageStatus = useMemo(() => {
    switch (state.status) {
      case "loading":
        return "loading";
      case "no_video":
        return "no_transcript";
      case "processing":
        return "fetching_transcript";
      case "ready":
      case "error":
        return "ready";
      default:
        return "loading";
    }
  }, [state.status]);

  const transcriptState: TranscriptState = useMemo(
    () => ({
      status: state.processingProgress ? "fetching" : "completed",
      progress: state.processingProgress?.progress ?? 100,
      message: state.processingProgress?.message ?? "",
      error: state.error,
    }),
    [state.processingProgress, state.error],
  );

  const analysisState: AnalysisState = useMemo(
    () => ({
      status: state.analysisProgress
        ? "running"
        : state.runs.length > 0
          ? "completed"
          : "idle",
      phase: state.analysisProgress?.phase ?? "",
      message: state.analysisProgress?.message ?? "",
      result: state.analysisProgress?.partial ?? null,
      runId: state.selectedRunId,
      error: state.error,
    }),
    [state.analysisProgress, state.runs, state.error],
  );

  const slidesState: SlidesState = useMemo(
    () => ({
      status: state.slidesProgress
        ? "extracting"
        : state.slides.length > 0
          ? "completed"
          : "idle",
      progress:
        state.slidesProgress?.progress ?? (state.slides.length > 0 ? 100 : 0),
      message:
        state.slidesProgress?.message ??
        (state.slides.length > 0 ? `${state.slides.length} slides loaded` : ""),
      error: state.error,
      slides: state.slides,
    }),
    [state.slidesProgress, state.slides, state.error],
  );

  const selectedRun = useMemo(
    () => state.runs.find((r) => r.id === state.selectedRunId) ?? null,
    [state.runs, state.selectedRunId],
  );

  const isAnalysisRunning = state.analysisProgress !== null;
  const hasRuns = state.runs.length > 0;

  const displayResult: unknown = useMemo(() => {
    if (isAnalysisRunning) {
      return state.analysisProgress?.partial ?? selectedRun?.result ?? null;
    }
    return selectedRun?.result ?? state.analysisProgress?.partial ?? null;
  }, [isAnalysisRunning, state.analysisProgress?.partial, selectedRun?.result]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleFetchTranscript = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    startProcessing(abortControllerRef.current.signal);
  }, [startProcessing]);

  const handleVersionChange = useCallback(
    (version: number) => {
      const run = state.runs.find((r) => r.version === version);
      if (run) {
        dispatch({ type: "SELECT_RUN", runId: run.id });
        const params = new URLSearchParams(searchParams.toString());
        params.set("v", version.toString());
        router.push(`?${params.toString()}`, { scroll: false });
      }
    },
    [state.runs, router, searchParams],
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

  // Backward compat: setSlidesState
  const setSlidesState = useCallback(
    (updater: SlidesState | ((prev: SlidesState) => SlidesState)) => {
      if (typeof updater === "function") {
        const newState = updater(slidesState);
        dispatch({ type: "SET_SLIDES_STATE", slides: newState.slides });
      } else {
        dispatch({ type: "SET_SLIDES_STATE", slides: updater.slides });
      }
    },
    [slidesState],
  );

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    pageStatus,
    videoInfo: state.video,
    runs: state.runs,
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
