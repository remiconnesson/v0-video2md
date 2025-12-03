"use client";

import { useCallback, useState } from "react";
import type { TranscriptStreamEvent } from "@/app/workflows/fetch-transcript";
import { consumeSSE } from "@/lib/sse";

interface TranscriptState {
  status: "idle" | "fetching" | "completed" | "error";
  progress: number;
  message: string;
  videoInfo?: {
    title: string;
    channelName?: string;
  };
  error?: string;
}

export function useTranscriptFetcher(youtubeId: string) {
  const [state, setState] = useState<TranscriptState>({
    status: "idle",
    progress: 0,
    message: "",
  });

  const startFetching = useCallback(async () => {
    setState({
      status: "fetching",
      progress: 10,
      message: "Connecting to YouTube...",
    });

    try {
      const res = await fetch(`/api/video/${youtubeId}/fetch`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch transcript");
      }

      await consumeSSE<TranscriptStreamEvent>(res, {
        progress: (data) =>
          setState((prev) => ({
            ...prev,
            progress: data.progress ?? prev.progress,
            message: data.message ?? prev.message,
          })),
        complete: (data) =>
          setState({
            status: "completed",
            progress: 100,
            message: "Transcript fetched successfully",
            videoInfo: data.video,
          }),
        error: (data) => {
          throw new Error(data.error);
        },
      });
    } catch (err) {
      setState({
        status: "error",
        progress: 0,
        message: "",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [youtubeId]);

  return { state, startFetching };
}
