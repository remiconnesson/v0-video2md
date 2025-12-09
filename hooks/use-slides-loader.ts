"use client";

import { useCallback } from "react";
import type { SlidesState } from "@/lib/slides-types";

export interface UseSlidesLoaderReturn {
  loadExistingSlides: () => Promise<void>;
}

export function useSlidesLoader(
  youtubeId: string,
  onSlidesStateChange: React.Dispatch<React.SetStateAction<SlidesState>>,
): UseSlidesLoaderReturn {
  // ============================================================================
  // Load Existing Slides
  // ============================================================================

  const loadExistingSlides = useCallback(async () => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/slides`);
      if (!res.ok) {
        let errorMessage = `Failed to load slides (${res.status})`;
        try {
          const errorData = await res.text();
          if (errorData) {
            errorMessage += `: ${errorData}`;
          }
        } catch {
          // Ignore errors when trying to read response body
        }
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
          slides: [],
        }));
        return;
      }

      const data = await res.json();
      const slides = Array.isArray(data.slides) ? data.slides : [];

      if (slides.length > 0) {
        onSlidesStateChange({
          status: "completed",
          progress: 100,
          message: `${slides.length} slides loaded`,
          error: null,
          slides,
        });
      } else if (data.status === "in_progress") {
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "extracting",
          progress: 0,
          message: "Extraction in progress...",
          error: null,
          slides: [],
        }));
      } else if (data.status === "failed") {
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "error",
          error: data.errorMessage || "Extraction failed",
          slides: [],
        }));
      } else {
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "idle",
          progress: 0,
          message: "",
          error: null,
          slides: [],
        }));
      }
    } catch (err) {
      console.error("Failed to load existing slides:", err);
      onSlidesStateChange((prev) => ({
        ...prev,
        status: "error",
        error: "Failed to load existing slides",
      }));
    }
  }, [youtubeId, onSlidesStateChange]);

  return {
    loadExistingSlides,
  };
}
