// hooks/use-slide-stream.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ProgressStreamEvent,
  SlideStreamEvent,
  SlideStreamEventData,
} from "@/lib/slides-extractor-types";
import { JobStatus } from "@/lib/slides-extractor-types";

interface SlideData {
  slide_index: number;
  chapter_index: number;
  frame_id: string;
  start_time: number;
  end_time: number;
  image_url: string;
  has_text: boolean;
  text_confidence: number;
}

interface UseSlideStreamOptions {
  /** Whether to use the mock endpoint for development */
  useMock?: boolean;
  /** Callback when a new slide is received */
  onSlide?: (slide: SlideData) => void;
  /** Callback when progress updates */
  onProgress?: (status: JobStatus, progress: number, message: string) => void;
  /** Callback when extraction completes */
  onComplete?: (totalSlides: number) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

interface UseSlideStreamReturn {
  /** Current extraction status */
  status: JobStatus | null;
  /** Current progress (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** All received slides */
  slides: SlideData[];
  /** Slides grouped by chapter index */
  slidesByChapter: Map<number, SlideData[]>;
  /** Whether the stream is currently active */
  isStreaming: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Total slides count (available after completion) */
  totalSlides: number | null;
  /** Start the extraction */
  startExtraction: (videoId: string, chapters?: unknown[]) => Promise<void>;
  /** Cancel the extraction */
  cancel: () => void;
}

export function useSlideStream(
  options: UseSlideStreamOptions = {},
): UseSlideStreamReturn {
  const { useMock = false, onSlide, onProgress, onComplete, onError } = options;

  const [status, setStatus] = useState<JobStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [slidesByChapter, setSlidesByChapter] = useState<
    Map<number, SlideData[]>
  >(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSlides, setTotalSlides] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addSlide = useCallback(
    (slide: SlideData) => {
      setSlides((prev) => [...prev, slide]);
      setSlidesByChapter((prev) => {
        const newMap = new Map(prev);
        const chapter = slide.chapter_index;
        const existing = newMap.get(chapter) || [];
        newMap.set(chapter, [...existing, slide]);
        return newMap;
      });
      onSlide?.(slide);
    },
    [onSlide],
  );

  const processEvent = useCallback(
    (event: SlideStreamEvent) => {
      switch (event.type) {
        case "progress": {
          const data = event.data as ProgressStreamEvent["data"];
          setStatus(data.status);
          setProgress(data.progress);
          setMessage(data.message);
          onProgress?.(data.status, data.progress, data.message);
          break;
        }
        case "slide": {
          const data = event.data as SlideStreamEventData["data"];
          addSlide(data);
          break;
        }
        case "complete": {
          const data = event.data as { total_slides: number; video_id: string };
          setTotalSlides(data.total_slides);
          setStatus(JobStatus.COMPLETED);
          setIsStreaming(false);
          onComplete?.(data.total_slides);
          break;
        }
        case "error": {
          const data = event.data as { message: string };
          setError(data.message);
          setStatus(JobStatus.FAILED);
          setIsStreaming(false);
          onError?.(data.message);
          break;
        }
      }
    },
    [addSlide, onProgress, onComplete, onError],
  );

  const startExtraction = useCallback(
    async (videoId: string, chapters?: unknown[]) => {
      // Reset state
      setSlides([]);
      setSlidesByChapter(new Map());
      setError(null);
      setTotalSlides(null);
      setProgress(0);
      setMessage("");
      setStatus(JobStatus.PENDING);
      setIsStreaming(true);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      const endpoint = useMock
        ? `/api/video/${videoId}/slides/mock`
        : `/api/video/${videoId}/slides`;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chapters }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete events (SSE format: data: {...}\n\n)
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6); // Remove "data: " prefix
                const event: SlideStreamEvent = JSON.parse(jsonStr);
                processEvent(event);
              } catch (e) {
                console.warn("Failed to parse SSE event:", e);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Cancelled by user
          setMessage("Extraction cancelled");
        } else {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          setStatus(JobStatus.FAILED);
          onError?.(errorMessage);
        }
        setIsStreaming(false);
      }
    },
    [useMock, processEvent, onError],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    status,
    progress,
    message,
    slides,
    slidesByChapter,
    isStreaming,
    error,
    totalSlides,
    startExtraction,
    cancel,
  };
}
