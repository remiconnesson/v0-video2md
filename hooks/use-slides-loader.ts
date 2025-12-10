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
      const response = await fetch(`/api/video/${youtubeId}/slides`);
      if (!response.ok) {
        let errorMessage = `Failed to load slides (${response.status})`;
        try {
          const errorData = await response.text();
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

      const slidesData = await response.json();
      const slides = Array.isArray(slidesData.slides) ? slidesData.slides : [];

      if (slides.length > 0) {
        onSlidesStateChange({
          status: "completed",
          progress: 100,
          message: `${slides.length} slides loaded`,
          error: null,
          slides,
        });
      } else if (slidesData.status === "in_progress") {
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "extracting",
          progress: 0,
          message: "Extraction in progress...",
          error: null,
          slides: [],
        }));
      } else if (slidesData.status === "failed") {
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "error",
          error: slidesData.errorMessage || "Extraction failed",
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
    } catch (loadError) {
      console.error("Failed to load existing slides:", loadError);
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
