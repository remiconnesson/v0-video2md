"use client";

import { useCallback, useState } from "react";

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
      // TODO: route is missing
      const res = await fetch(`/api/video/${youtubeId}/fetch`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to fetch transcript");
      }

      // Handle SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress") {
              setState((prev) => ({
                ...prev,
                progress: data.progress ?? prev.progress,
                message: data.message ?? prev.message,
              }));
            } else if (data.type === "complete") {
              setState({
                status: "completed",
                progress: 100,
                message: "Transcript fetched successfully",
                videoInfo: data.video,
              });
            } else if (data.type === "error") {
              throw new Error(data.error);
            }
          }
        }
      }
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
