"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SlideAnalysisResultsResponse,
  SlideFeedbackResponse,
  SlidesResponse,
} from "./api-types";
import type { SlideAnalysisTarget } from "./slides-types";

export function useSlidesQuery(videoId: string) {
  return useQuery<SlidesResponse>({
    queryKey: ["slides", videoId],
    queryFn: async () => {
      const response = await fetch(`/api/video/${videoId}/slides`);
      if (!response.ok) throw new Error("Failed to load slides");
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute
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
    staleTime: 1 * 60 * 1000, // 1 minute
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
    staleTime: 1 * 60 * 1000, // 1 minute
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
      // Return the Response object for SSE consumption
      return response;
    },
    onSuccess: () => {
      // Invalidate analysis query to refetch after SSE stream completes
      queryClient.invalidateQueries({ queryKey: ["slide-analysis", videoId] });
    },
  });
}
