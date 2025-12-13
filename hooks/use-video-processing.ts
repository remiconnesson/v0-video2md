import { useEffect, useState } from "react";
import type { SlidesState } from "@/lib/slides-types";

// ============================================================================
// Types
// ============================================================================

export interface VideoInfo {
  id: string;
  title: string;
  channelName: string;
  description?: string;
  thumbnailUrl?: string;
}

export interface AnalysisRun {
  id: number;
  version: number;
  result?: Record<string, unknown>;
  createdAt: Date;
}

interface StateWithProgress {
  message: string;
  progress: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useVideoProcessing(
  youtubeId: string,
  _initialVersion?: number,
) {
  const [pageStatus, setPageStatus] = useState<
    "loading" | "ready" | "error" | "no_transcript" | "fetching_transcript"
  >("loading");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);
  const [transcriptState, setTranscriptState] = useState<
    StateWithProgress & { status: "idle" | "loading" | "success" | "error" }
  >({
    status: "idle",
    message: "",
    progress: 0,
  });
  const [analysisState, setAnalysisState] = useState<
    StateWithProgress & { status: "idle" | "running" | "success" | "error" }
  >({
    status: "idle",
    message: "",
    progress: 0,
  });
  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
    slides: [],
  });
  const [isAnalysisRunning, setIsAnalysisRunning] = useState(false);

  const hasRuns = runs.length > 0;
  const displayResult = selectedRun?.result;

  // Mock implementation - this would need to be replaced with actual API calls
  useEffect(() => {
    // Simulate loading video info
    setTimeout(() => {
      setVideoInfo({
        id: youtubeId,
        title: "Sample Video Title",
        channelName: "Sample Channel",
        description: "Sample description",
      });
      setPageStatus("no_transcript");
    }, 1000);
  }, [youtubeId]);

  const handleFetchTranscript = async () => {
    setPageStatus("fetching_transcript");
    setTranscriptState({
      status: "loading",
      message: "Fetching transcript from YouTube...",
      progress: 50,
    });
    // Mock implementation
    setTimeout(() => {
      setTranscriptState({
        status: "success",
        message: "Transcript fetched successfully",
        progress: 100,
      });
      setPageStatus("ready");
    }, 2000);
  };

  const handleVersionChange = (version: number) => {
    const run = runs.find((r) => r.version === version);
    setSelectedRun(run || null);
  };

  const handleStartAnalysis = async () => {
    setIsAnalysisRunning(true);
    setAnalysisState({
      status: "running",
      message: "Analyzing transcript...",
      progress: 0,
    });
    // Mock implementation
    setTimeout(() => {
      setIsAnalysisRunning(false);
      setAnalysisState({
        status: "success",
        message: "Analysis completed",
        progress: 100,
      });
      // Add a new run
      const newRun: AnalysisRun = {
        id: Date.now(),
        version: runs.length + 1,
        result: { sample: "analysis result" },
        createdAt: new Date(),
      };
      setRuns((prev) => [...prev, newRun]);
      setSelectedRun(newRun);
    }, 3000);
  };

  const handleReroll = async (_instructions?: string) => {
    // Mock implementation for reroll
    await handleStartAnalysis();
  };

  return {
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
    handleFetchTranscript,
    handleVersionChange,
    handleStartAnalysis,
    handleReroll,
    setSlidesState,
  };
}
