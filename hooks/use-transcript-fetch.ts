"use client";

import { Match } from "effect";
import { useCallback, useRef, useState } from "react";
import type { ProcessingStreamEvent } from "@/app/api/video/[videoId]/process/route";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
import type { SlidesState } from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";

export type PageStatus =
  | "loading"
  | "no_transcript"
  | "fetching_transcript"
  | "ready";

export type TranscriptStatus = "idle" | "fetching" | "completed" | "error";

export interface TranscriptState {
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

  // Ref to track if processing is in progress and for abort control
  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);

  // ============================================================================
  // Start Processing
  // ============================================================================

  const startProcessing = useCallback(async () => {
    // Prevent multiple simultaneous starts
    if (isProcessingRef.current) {
      return;
    }

    // Cancel any previous processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this processing session
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isProcessingRef.current = true;

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
      const response = await fetch(`/api/video/${youtubeId}/process`, {
        method: "POST",
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to start processing");
      }

      await consumeSSE<ProcessingStreamEvent>(response, {
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
    } catch (processingError) {
      if (
        processingError instanceof Error &&
        processingError.name === "AbortError"
      ) {
        return;
      }

      console.error("Failed to start processing:", processingError);
      setPageStatus("no_transcript");
      setTranscriptState((prev) => ({
        ...prev,
        status: "error",
        error:
          processingError instanceof Error
            ? processingError.message
            : "Unknown error",
      }));
    } finally {
      isProcessingRef.current = false;
      abortControllerRef.current = null;
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
      const response = await fetch(`/api/video/${youtubeId}`);
      if (!response.ok) {
        setPageStatus("no_transcript");
        return { status, hasStreamingAnalysis };
      }

      const videoData = await response.json();
      status = videoData.status as VideoStatus;

      if (status === "not_found") {
        setPageStatus("no_transcript");
        return { status, hasStreamingAnalysis };
      }

      if (videoData.video) {
        setVideoInfo({
          title: videoData.video.title,
          channelName: videoData.video.channelName,
          thumbnail: videoData.video.thumbnail,
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
    } catch (checkError) {
      console.error("Failed to check video status:", checkError);
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
