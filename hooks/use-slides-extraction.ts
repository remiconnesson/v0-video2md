import { useCallback, useEffect, useRef, useState } from "react";
import type { SlideData, SlideStreamEvent } from "@/lib/slides-types";

export type SlideExtractionStatus =
  | "idle"
  | "loading"
  | "extracting"
  | "completed"
  | "error";

export interface SlideExtractionState {
  status: SlideExtractionStatus;
  progress: number;
  message: string;
  error: string | null;
}

interface UseSlideExtractionReturn {
  state: SlideExtractionState;
  slides: SlideData[];
  startExtraction: () => Promise<void>;
  loadExistingSlides: () => Promise<void>;
  abort: () => void;
}

export function useSlideExtraction(videoId: string): UseSlideExtractionReturn {
  const [state, setState] = useState<SlideExtractionState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
  });
  const [slides, setSlides] = useState<SlideData[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // NEW: Add cleanup effect
  // This ensures that if the user navigates away while extracting, we stop processing
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Load existing slides from DB
  const loadExistingSlides = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading" }));

    try {
      const res = await fetch(`/api/video/${videoId}/slides`);
      if (!res.ok) throw new Error("Failed to fetch slides");

      const data = await res.json();

      if (data.status === "completed" && data.slides.length > 0) {
        setSlides(data.slides);
        setState({
          status: "completed",
          progress: 100,
          message: `${data.slides.length} slides loaded`,
          error: null,
        });
      } else if (data.status === "in_progress" && data.runId) {
        // Resume existing extraction
        setState({
          status: "extracting",
          progress: 50,
          message: "Resuming extraction...",
          error: null,
        });
        // Could implement stream resumption here
      } else {
        setState({
          status: "idle",
          progress: 0,
          message: "",
          error: null,
        });
      }
    } catch (err) {
      setState({
        status: "error",
        progress: 0,
        message: "",
        error: err instanceof Error ? err.message : "Failed to load slides",
      });
    }
  }, [videoId]);

  // Start new extraction
  const startExtraction = useCallback(async () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setState({
      status: "extracting",
      progress: 0,
      message: "Starting extraction...",
      error: null,
    });
    setSlides([]);

    try {
      const res = await fetch(`/api/video/${videoId}/slides`, {
        method: "POST",
        signal: abortControllerRef.current.signal,
      });

      // Handle already extracted
      if (res.status === 409) {
        await loadExistingSlides();
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error("Failed to start extraction");
      }

      // Process SSE stream
      const reader = res.body.getReader();
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
            try {
              const event: SlideStreamEvent = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                setState((prev) => ({
                  ...prev,
                  progress: event.progress,
                  message: event.message,
                }));
              } else if (event.type === "slide") {
                setSlides((prev) => [...prev, event.slide]);
              } else if (event.type === "complete") {
                setState({
                  status: "completed",
                  progress: 100,
                  message: `Extracted ${event.totalSlides} slides`,
                  error: null,
                });
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch (parseErr) {
              if (!(parseErr instanceof SyntaxError)) throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;

      setState({
        status: "error",
        progress: 0,
        message: "",
        error: err instanceof Error ? err.message : "Extraction failed",
      });
    }
  }, [videoId, loadExistingSlides]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    state,
    slides,
    startExtraction,
    loadExistingSlides,
    abort,
  };
}
