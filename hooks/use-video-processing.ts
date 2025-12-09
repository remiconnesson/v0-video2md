"use client";

import { Match } from "effect";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ProcessingStreamEvent } from "@/app/api/video/[videoId]/process/route";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
import type { SlidesState } from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";

// ============================================================================
// Types
// ============================================================================

export interface AnalysisRun {
  id: number;
  version: number;
  status: string;
  result: unknown;
  workflowRunId: string | null;
  additionalInstructions: string | null;
  createdAt: string;
}

interface StreamingRunInfo {
  id: number;
  version: number;
  workflowRunId: string | null;
}

export interface VideoInfo {
  title: string;
  channelName?: string;
  thumbnail?: string;
}

export type PageStatus =
  | "loading"
  | "no_transcript"
  | "fetching_transcript"
  | "ready";

type TranscriptStatus = "idle" | "fetching" | "completed" | "error";

interface TranscriptState {
  status: TranscriptStatus;
  progress: number;
  message: string;
  error: string | null;
}

// ============================================================================
// Hook Return Type
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
// Main Hook
// ============================================================================

export function useVideoProcessing(
  youtubeId: string,
  initialVersion?: number,
): UseVideoProcessingReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);

  const [transcriptState, setTranscriptState] = useState<TranscriptState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
  });

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
    slides: [],
  });

  // ============================================================================
  // Fetch Runs
  // ============================================================================

  const fetchRuns = useCallback(async (): Promise<{
    runs: AnalysisRun[];
    streamingRun: StreamingRunInfo | null;
  }> => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/analyze`);
      if (!res.ok) return { runs: [], streamingRun: null };
      const data = await res.json();
      setRuns(data.runs);

      if (data.runs.length > 0) {
        const targetVersion = initialVersion ?? data.runs[0].version;
        const run = data.runs.find(
          (r: AnalysisRun) => r.version === targetVersion,
        );
        setSelectedRun(run ?? data.runs[0]);
      }

      return {
        runs: data.runs,
        streamingRun: data.streamingRun as StreamingRunInfo | null,
      };
    } catch (err) {
      console.error("Failed to fetch runs:", err);
      return { runs: [], streamingRun: null };
    }
  }, [youtubeId, initialVersion]);

  // ============================================================================
  // Analysis Stream Consumption
  // ============================================================================

  const consumeAnalysisStream = useCallback(async (response: Response) => {
    await consumeSSE<AnalysisStreamEvent>(response, {
      progress: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          phase: event.phase,
          message: event.message,
        })),
      partial: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          result: event.data,
        })),
      result: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          result: event.data,
        })),
      complete: (event) =>
        setAnalysisState((prev) => ({
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
  }, []);

  // ============================================================================
  // Resume Analysis Stream
  // ============================================================================

  const resumeAnalysisStream = useCallback(async () => {
    setAnalysisState({
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

        const { runs: updatedRuns } = await fetchRuns();

        if (completed || updatedRuns.length > 0) {
          const latestRun = updatedRuns[0];
          if (latestRun?.result) {
            setSelectedRun(latestRun);
          }
          setAnalysisState({
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

      setAnalysisState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
    }
  }, [youtubeId, fetchRuns, consumeAnalysisStream]);

  // ============================================================================
  // Start Analysis Run
  // ============================================================================

  const startAnalysisRun = useCallback(
    async (additionalInstructions?: string) => {
      setAnalysisState({
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

        setAnalysisState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    },
    [youtubeId, consumeAnalysisStream],
  );

  // ============================================================================
  // Load Existing Slides
  // ============================================================================

  const loadExistingSlides = useCallback(async () => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/slides`);
      if (!res.ok) return;

      const data = await res.json();

      if (data.slides.length > 0) {
        setSlidesState({
          status: "completed",
          progress: 100,
          message: `${data.slides.length} slides loaded`,
          error: null,
          slides: data.slides,
        });
      } else if (data.status === "in_progress") {
        setSlidesState((prev) => ({
          ...prev,
          status: "extracting",
          progress: 0,
          message: "Extraction in progress...",
          slides: [],
        }));
      } else if (data.status === "failed") {
        setSlidesState((prev) => ({
          ...prev,
          status: "error",
          error: data.errorMessage || "Extraction failed",
          slides: [],
        }));
      } else {
        setSlidesState((prev) => ({
          ...prev,
          status: "idle",
          slides: [],
        }));
      }
    } catch (err) {
      console.error("Failed to load existing slides:", err);
      setSlidesState((prev) => ({
        ...prev,
        status: "error",
        error: "Failed to load existing slides",
      }));
    }
  }, [youtubeId]);

  // ============================================================================
  // Start Processing
  // ============================================================================

  const startProcessing = useCallback(async () => {
    setPageStatus("fetching_transcript");
    setTranscriptState({
      status: "fetching",
      progress: 10,
      message: "Connecting to YouTube...",
      error: null,
    });
    setSlidesState((prev) => ({
      ...prev,
      status: "extracting",
      progress: 0,
      message: "Starting slides extraction...",
      error: null,
      slides: [],
    }));

    try {
      const res = await fetch(`/api/video/${youtubeId}/process`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to start processing");
      }

      await consumeSSE<ProcessingStreamEvent>(res, {
        slide: (event) => {
          setSlidesState((prev) => ({
            ...prev,
            slides: [...prev.slides, event.slide],
          }));
        },
        progress: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "unified" }, (event) => {
              if (event.phase === "fetching") {
                setTranscriptState((prev) => ({
                  ...prev,
                  status: "fetching",
                  progress: event.progress ?? prev.progress,
                  message: event.message ?? prev.message,
                }));
              } else {
                setAnalysisState((prev) => ({
                  ...prev,
                  status: "running",
                  phase: event.phase,
                  message: event.message,
                }));
              }
            }),
            Match.when({ source: "slides" }, (event) => {
              setSlidesState((prev) => ({
                ...prev,
                status: "extracting",
                progress: event.progress ?? prev.progress,
                message: event.message ?? prev.message,
              }));
            }),
            Match.exhaustive,
          );
        },
        partial: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "unified" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "running",
                result: event.data,
              }));
            }),
            Match.orElse(() => {}),
          );
        },
        result: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "unified" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "running",
                result: event.data,
              }));
            }),
            Match.orElse(() => {}),
          );
        },
        complete: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "unified" }, (event) => {
              setTranscriptState({
                status: "completed",
                progress: 100,
                message: "Transcript fetched successfully",
                error: null,
              });

              if (event.video) {
                setVideoInfo({
                  title: event.video.title,
                  channelName: event.video.channelName,
                });
              }

              setPageStatus("ready");

              setAnalysisState((prev) => ({
                ...prev,
                status: "completed",
                runId: event.runId,
                phase: "complete",
                message: "Analysis complete!",
              }));
            }),
            Match.when({ source: "slides" }, (event) => {
              setSlidesState((prev) => ({
                ...prev,
                status: "completed",
                progress: 100,
                message: `Extracted ${event.totalSlides} slides`,
                error: null,
              }));
            }),
            Match.exhaustive,
          );
        },
        error: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "unified" }, (event) => {
              setTranscriptState({
                status: "error",
                progress: 0,
                message: "",
                error: event.error,
              });
              setAnalysisState((prev) => ({
                ...prev,
                status: "error",
                error: event.error,
              }));
              setPageStatus("no_transcript");
            }),
            Match.when({ source: "slides" }, (event) => {
              setSlidesState((prev) => ({
                ...prev,
                status: "error",
                progress: 0,
                message: "",
                error: event.message,
              }));
            }),
            Match.exhaustive,
          );
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("Failed to start processing:", err);
      setPageStatus("no_transcript");
      setTranscriptState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [youtubeId]);

  // ============================================================================
  // Check Video Status
  // ============================================================================

  const checkVideoStatus = useCallback(async () => {
    type VideoStatus = "not_found" | "processing" | "ready";

    let status: VideoStatus = "not_found";
    let hasStreamingAnalysis = false;

    try {
      const res = await fetch(`/api/video/${youtubeId}`);
      if (!res.ok) {
        setPageStatus("no_transcript");
        return { status, hasStreamingAnalysis };
      }

      const data = await res.json();
      status = data.status as VideoStatus;

      if (status === "not_found") {
        setPageStatus("no_transcript");
        return { status, hasStreamingAnalysis };
      }

      if (data.video) {
        setVideoInfo({
          title: data.video.title,
          channelName: data.video.channelName,
          thumbnail: data.video.thumbnail,
        });
      }

      if (status === "ready") {
        setPageStatus("ready");
        setTranscriptState({
          status: "completed",
          progress: 100,
          message: "Transcript already fetched",
          error: null,
        });
        const [runsResult] = await Promise.all([
          fetchRuns(),
          loadExistingSlides(),
        ]);

        if (runsResult.streamingRun?.workflowRunId) {
          hasStreamingAnalysis = true;
        }
      } else if (status === "processing") {
        setPageStatus("fetching_transcript");
        setTranscriptState((prev) => ({
          ...prev,
          status: "fetching",
          progress: Math.max(prev.progress, 10),
          message: "Resuming transcript fetch...",
          error: null,
        }));
      } else {
        setPageStatus("no_transcript");
      }

      return { status, hasStreamingAnalysis };
    } catch (err) {
      console.error("Failed to check video status:", err);
      setPageStatus("no_transcript");
      return { status, hasStreamingAnalysis };
    }
  }, [youtubeId, fetchRuns, loadExistingSlides]);

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
        startProcessing();
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
    router,
    searchParams,
  ]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleFetchTranscript = useCallback(() => {
    setPageStatus("fetching_transcript");
    startProcessing();
  }, [startProcessing]);

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

  const isAnalysisRunning = analysisState.status === "running";
  const hasRuns = runs.length > 0;
  const displayResult: unknown = isAnalysisRunning
    ? analysisState.result
    : (selectedRun?.result ?? null);

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
