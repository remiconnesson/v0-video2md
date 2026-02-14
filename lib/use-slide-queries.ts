"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SlideAnalysisResultsResponse,
  SlideFeedbackResponse,
  SlidesResponse,
} from "./api-types";
import type { SlideAnalysisTarget } from "./slides-types";

const SLIDES_POLL_INTERVAL_MS = 3000;

export function useSlidesQuery(videoId: string) {
  return useQuery<SlidesResponse>({
    queryKey: ["slides", videoId],
    queryFn: async () => {
      const response = await fetch(`/api/video/${videoId}/slides`);
      if (!response.ok) throw new Error("Failed to load slides");
      return response.json();
    },
    staleTime: Number.POSITIVE_INFINITY, // Slides never change once extracted
    // Poll while extraction is in progress so we pick up completion from the
    // eagerly-started workflow (which runs independently of any SSE stream).
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "in_progress" || status === "pending") {
        return SLIDES_POLL_INTERVAL_MS;
      }
      return false;
    },
  });
}

export function useSlideFeedbackQuery(videoId: string) {
  return useQuery<SlideFeedbackResponse>({
    queryKey: ["slide-feedback", videoId],
    queryFn: async () => {
      const response = await fetch(`/api/video/${videoId}/slides/feedback`);
      if (!response.ok) throw new Error("Failed to load slide feedback");
      return response.json();
    },
    staleTime: Number.POSITIVE_INFINITY, // Feedback is persisted and invalidated by mutations
  });
}

export function useSlideAnalysisQuery(videoId: string) {
  return useQuery<SlideAnalysisResultsResponse>({
    queryKey: ["slide-analysis", videoId],
    queryFn: async () => {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`);
      if (!response.ok) throw new Error("Failed to load analysis results");
      return response.json();
    },
    staleTime: Number.POSITIVE_INFINITY, // Analysis results never change once completed
  });
}

export function useTriggerSlideAnalysisMutation(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to trigger analysis");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate analysis query to refetch
      queryClient.invalidateQueries({ queryKey: ["slide-analysis", videoId] });
    },
  });
}

export function useSaveSlideFeedbackMutation(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feedback: {
      slideNumber: number;
      firstFrameHasUsefulContent?: boolean | null;
      lastFrameHasUsefulContent?: boolean | null;
      framesSameness?: "same" | "different" | null;
      isFirstFramePicked?: boolean;
      isLastFramePicked?: boolean;
    }) => {
      const response = await fetch(`/api/video/${videoId}/slides/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(feedback),
      });
      if (!response.ok) throw new Error("Failed to save feedback");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate feedback query to refetch
      queryClient.invalidateQueries({ queryKey: ["slide-feedback", videoId] });
      // Also invalidate analysis as it may depend on feedback
      queryClient.invalidateQueries({ queryKey: ["slide-analysis", videoId] });
    },
  });
}

export function usePickSlidesMutation(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: SlideAnalysisTarget[]) => {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targets }),
      });
      if (!response.ok) throw new Error("Failed to pick slides");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate analysis query to refetch
      queryClient.invalidateQueries({ queryKey: ["slide-analysis", videoId] });
    },
  });
}
