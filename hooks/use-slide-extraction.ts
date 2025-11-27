import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SlideEvent,
  SlideStreamEvent,
} from "@/lib/slides-extractor-types";
import { JobStatus } from "@/lib/slides-extractor-types";
import type { BookContent } from "./use-video-processing";

export type SlideExtractionStatus = "idle" | "extracting" | "ready" | "error";

export interface SlideExtractionState {
  status: SlideExtractionStatus;
  message: string;
  progress: number;
  runId?: string;
}

const JOB_STATUS_PROGRESS: Record<JobStatus, number> = {
  [JobStatus.PENDING]: 10,
  [JobStatus.DOWNLOADING]: 30,
  [JobStatus.EXTRACTING]: 60,
  [JobStatus.UPLOADING]: 80,
  [JobStatus.COMPLETED]: 100,
  [JobStatus.FAILED]: 0,
};

interface UseSlideExtractionReturn {
  slideExtraction: SlideExtractionState;
  slides: SlideEvent[];
  startSlideExtraction: () => Promise<void>;
  abortSlideExtraction: () => void;
}

export function useSlideExtraction(
  youtubeId: string,
  bookContent: BookContent | null,
): UseSlideExtractionReturn {
  const [slideExtraction, setSlideExtraction] = useState<SlideExtractionState>({
    status: "idle",
    message: "",
    progress: 0,
  });
  const [slides, setSlides] = useState<SlideEvent[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startSlideExtraction = useCallback(async () => {
    // Abort any existing extraction
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this extraction
    abortControllerRef.current = new AbortController();

    setSlideExtraction({
      status: "extracting",
      message: "Starting slide extraction...",
      progress: 5,
    });
    setSlides([]);

    try {
      const response = await fetch(`/api/video/${youtubeId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapters: bookContent?.chapters,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start slide extraction");
      }

      const runId = response.headers.get("X-Workflow-Run-Id");
      if (runId) {
        setSlideExtraction((prev) => ({ ...prev, runId }));
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
              const event: SlideStreamEvent = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                const progressData = event.data as {
                  status: JobStatus;
                  progress: number;
                  message: string;
                };
                setSlideExtraction({
                  status: "extracting",
                  message: progressData.message,
                  progress:
                    JOB_STATUS_PROGRESS[progressData.status] ||
                    progressData.progress,
                  runId: runId ?? undefined,
                });
              } else if (event.type === "slide") {
                const slideData = event.data as SlideEvent;
                setSlides((prev) => [...prev, slideData]);
              } else if (event.type === "complete") {
                setSlideExtraction({
                  status: "ready",
                  message: "Slides extracted successfully!",
                  progress: 100,
                  runId: runId ?? undefined,
                });
              } else if (event.type === "error") {
                const errorData = event.data as { message: string };
                throw new Error(errorData.message);
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
    } catch (err) {
      // Ignore abort errors - extraction was cancelled
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const errorMessage =
        err instanceof Error ? err.message : "Slide extraction failed";
      setSlideExtraction({
        status: "error",
        message: errorMessage,
        progress: 0,
      });
    }
  }, [youtubeId, bookContent]);

  const abortSlideExtraction = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    slideExtraction,
    slides,
    startSlideExtraction,
    abortSlideExtraction,
  };
}
