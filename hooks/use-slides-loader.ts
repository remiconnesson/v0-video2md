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
      if (!res.ok) return;

      const data = await res.json();

      if (data.slides.length > 0) {
        onSlidesStateChange({
          status: "completed",
          progress: 100,
          message: `${data.slides.length} slides loaded`,
          error: null,
          slides: data.slides,
        });
      } else if (data.status === "in_progress") {
        onSlidesStateChange((prev) => ({
          ...prev,
          status: "extracting",
          progress: 0,
          message: "Extraction in progress...",
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
