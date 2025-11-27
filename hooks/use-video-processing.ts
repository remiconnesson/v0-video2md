import { useCallback, useEffect, useState } from "react";
import type { Chapter } from "@/ai/transcript-to-book-schema";
import type { TranscriptWorkflowEvent } from "@/app/workflows/fetch-transcript";
import { fetchYoutubeVideoTitle } from "@/lib/youtube-utils";

export interface VideoInfo {
  videoId: string;
  url: string;
  title: string;
  channelName?: string;
  description?: string;
  thumbnail?: string;
}

export interface BookContent {
  videoSummary: string;
  chapters: Chapter[];
}

export type VideoStatus = "not_found" | "processing" | "ready";

export interface ProcessingState {
  step: string;
  message: string;
  progress: number;
}

const STEP_PROGRESS: Record<string, number> = {
  fetching: 20,
  saving: 40,
  analyzing: 70,
  finalizing: 90,
};

interface UseVideoProcessingReturn {
  videoStatus: VideoStatus | null;
  video: VideoInfo | null;
  bookContent: BookContent | null;
  isLoading: boolean;
  error: string | null;
  processingState: ProcessingState;
}

export function useVideoProcessing(
  youtubeId: string,
): UseVideoProcessingReturn {
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    step: "",
    message: "Starting...",
    progress: 0,
  });

  // Start the transcript processing workflow and consume the stream
  const startProcessing = useCallback(
    async (signal?: AbortSignal) => {
      setVideoStatus("processing");
      setProcessingState({ step: "", message: "Starting...", progress: 5 });
      let completed = false;

      // Attempt to fetch the video title early to display in the header
      fetchYoutubeVideoTitle(youtubeId)
        .then((title) => {
          if (title) {
            setVideo((prev) => ({
              videoId: youtubeId,
              url: `https://www.youtube.com/watch?v=${youtubeId}`,
              title,
              ...(prev || {}),
            }));
          }
        })
        .catch((error) => {
          console.error("Failed to fetch video title:", error);
        });

      try {
        const response = await fetch(`/api/video/${youtubeId}/process`, {
          method: "POST",
          signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start processing");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: TranscriptWorkflowEvent = JSON.parse(
                  line.slice(6),
                );

                if (event.type === "progress") {
                  setProcessingState({
                    step: event.step,
                    message: event.message,
                    progress: STEP_PROGRESS[event.step] || 50,
                  });
                } else if (event.type === "complete") {
                  setBookContent(event.bookContent);
                  setVideoStatus("ready");
                  completed = true;
                  setProcessingState({
                    step: "complete",
                    message: "Complete!",
                    progress: 100,
                  });
                } else if (event.type === "error") {
                  throw new Error(event.message);
                }
              } catch (parseError) {
                // Only ignore JSON parse errors; propagate other errors
                if (parseError instanceof SyntaxError) {
                  // Ignore malformed SSE lines
                } else {
                  throw parseError;
                }
              }
            }
          }
        }

        // If we finished without getting a complete event, refetch video data
        if (!completed) {
          const videoRes = await fetch(`/api/video/${youtubeId}`);
          const data = await videoRes.json();
          if (data.status === "ready") {
            setVideo(data.video);
            setBookContent(data.bookContent);
            setVideoStatus("ready");
          }
        }
      } catch (err) {
        // Ignore abort errors - component unmounted
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Processing failed";
        setError(errorMessage);
        setVideoStatus(null);
      }
    },
    [youtubeId],
  );

  // Initial data fetch
  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const videoRes = await fetch(`/api/video/${youtubeId}`, {
          signal: abortController.signal,
        });

        if (!videoRes.ok) {
          setError(
            `Failed to load video: ${videoRes.statusText || "Unknown error"}`,
          );
          return;
        }

        const videoData = await videoRes.json();

        if (videoData.status === "not_found") {
          setVideoStatus("not_found");
          setIsLoading(false);
          startProcessing(abortController.signal);
          return;
        }

        if (videoData.status === "processing") {
          setVideo(videoData.video);
          setVideoStatus("processing");
          setIsLoading(false);
          startProcessing(abortController.signal);
          return;
        }

        // Video is ready
        setVideo(videoData.video);
        setBookContent(videoData.bookContent);
        setVideoStatus("ready");
      } catch (err) {
        // Ignore abort errors - component unmounted
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch data";
        console.error("[useVideoProcessing] Error fetching data:", err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [youtubeId, startProcessing]);

  return {
    videoStatus,
    video,
    bookContent,
    isLoading,
    error,
    processingState,
  };
}
