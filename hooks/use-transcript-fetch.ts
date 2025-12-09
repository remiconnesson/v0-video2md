"use client";

import { Match } from "effect";
import { useCallback, useState } from "react";
import type { ProcessingStreamEvent } from "@/app/api/video/[videoId]/process/route";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
import type { SlidesState } from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";

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

export interface VideoInfo {
  title: string;
  channelName?: string;
  thumbnail?: string;
}

export interface UseTranscriptFetchReturn {
  pageStatus: PageStatus;
  videoInfo: VideoInfo | null;
  transcriptState: TranscriptState;
  checkVideoStatus: () => Promise<{
    status: "not_found" | "processing" | "ready";
    hasStreamingAnalysis: boolean;
  }>;
  startProcessing: () => Promise<void>;
  handleFetchTranscript: () => void;
  setVideoInfo: React.Dispatch<React.SetStateAction<VideoInfo | null>>;
  setPageStatus: React.Dispatch<React.SetStateAction<PageStatus>>;
}

export function useTranscriptFetch(
  youtubeId: string,
  onSlidesStateChange: React.Dispatch<React.SetStateAction<SlidesState>>,
  onAnalysisStateChange: React.Dispatch<React.SetStateAction<AnalysisState>>,
): UseTranscriptFetchReturn {
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [transcriptState, setTranscriptState] = useState<TranscriptState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
  });

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
    onSlidesStateChange((prev) => ({
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
          onSlidesStateChange((prev) => ({
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
                onAnalysisStateChange((prev) => ({
                  ...prev,
                  status: "running",
                  phase: event.phase,
                  message: event.message,
                }));
              }
            }),
            Match.when({ source: "slides" }, (event) => {
              onSlidesStateChange((prev) => ({
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
              onAnalysisStateChange((prev) => ({
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
              onAnalysisStateChange((prev) => ({
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

              onAnalysisStateChange((prev) => ({
                ...prev,
                status: "completed",
                runId: event.runId,
                phase: "complete",
                message: "Analysis complete!",
              }));
            }),
            Match.when({ source: "slides" }, (event) => {
              onSlidesStateChange((prev) => ({
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
              onAnalysisStateChange((prev) => ({
                ...prev,
                status: "error",
                error: event.error,
              }));
              setPageStatus("no_transcript");
            }),
            Match.when({ source: "slides" }, (event) => {
              onSlidesStateChange((prev) => ({
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
  }, [youtubeId, onSlidesStateChange, onAnalysisStateChange]);

  // ============================================================================
  // Check Video Status
  // ============================================================================

  const checkVideoStatus = useCallback(async () => {
    type VideoStatus = "not_found" | "processing" | "ready";

    let status: VideoStatus = "not_found";
    // Note: hasStreamingAnalysis is initialized to false here.
    // The orchestrator (use-video-processing.ts) will set it to true
    // if a streaming run exists, as this hook doesn't have access to runs data.
    const hasStreamingAnalysis = false;

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
  }, [youtubeId]);

  // ============================================================================
  // Action Handlers
  // ============================================================================

  const handleFetchTranscript = useCallback(() => {
    setPageStatus("fetching_transcript");
    startProcessing();
  }, [startProcessing]);

  return {
    pageStatus,
    videoInfo,
    transcriptState,
    checkVideoStatus,
    startProcessing,
    handleFetchTranscript,
    setVideoInfo,
    setPageStatus,
  };
}
