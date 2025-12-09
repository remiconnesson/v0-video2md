import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVideoStatus } from "./use-video-status";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useVideoStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchRuns", () => {
    it("should fetch runs successfully", async () => {
      const mockRuns = [
        {
          id: 1,
          version: 1,
          status: "completed",
          result: { summary: "Test summary" },
          workflowRunId: "workflow-123",
          additionalInstructions: null,
          createdAt: "2023-01-01T00:00:00Z",
        },
        {
          id: 2,
          version: 2,
          status: "completed",
          result: { summary: "Updated summary" },
          workflowRunId: "workflow-456",
          additionalInstructions: "Focus on key points",
          createdAt: "2023-01-02T00:00:00Z",
        },
      ];

      const mockStreamingRun = {
        id: 3,
        version: 3,
        workflowRunId: "workflow-789",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            runs: mockRuns,
            streamingRun: mockStreamingRun,
          }),
      });

      const { result } = renderHook(() => useVideoStatus("test-video-id", 2));

      let fetchResult: { runs: any[]; streamingRun: any } = { runs: [], streamingRun: null };
      await act(async () => {
        fetchResult = await result.current.fetchRuns();
      });

      expect(fetchResult).toEqual({
        runs: mockRuns,
        streamingRun: mockStreamingRun,
      });

      expect(result.current.runs).toEqual(mockRuns);
      expect(result.current.selectedRun).toEqual(mockRuns[1]); // version 2

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/analyze",
      );
    });

    it("should select first run when no initial version provided", async () => {
      const mockRuns = [
        {
          id: 1,
          version: 1,
          status: "completed",
          result: { summary: "Test summary" },
          workflowRunId: "workflow-123",
          additionalInstructions: null,
          createdAt: "2023-01-01T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            runs: mockRuns,
            streamingRun: null,
          }),
      });

      const { result } = renderHook(() => useVideoStatus("test-video-id"));

      await act(async () => {
        await result.current.fetchRuns();
      });

      expect(result.current.selectedRun).toEqual(mockRuns[0]);
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useVideoStatus("test-video-id"));

      let fetchResult: { runs: any[]; streamingRun: any } = { runs: [], streamingRun: null };
      await act(async () => {
        fetchResult = await result.current.fetchRuns();
      });

      expect(fetchResult).toEqual({
        runs: [],
        streamingRun: null,
      });

      expect(result.current.runs).toEqual([]);
      expect(result.current.selectedRun).toBeNull();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useVideoStatus("test-video-id"));

      let fetchResult: { runs: any[]; streamingRun: any } = { runs: [], streamingRun: null };
      await act(async () => {
        fetchResult = await result.current.fetchRuns();
      });

      expect(fetchResult).toEqual({
        runs: [],
        streamingRun: null,
      });
    });

    it("should handle empty runs array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            runs: [],
            streamingRun: null,
          }),
      });

      const { result } = renderHook(() => useVideoStatus("test-video-id"));

      let fetchResult: { runs: any[]; streamingRun: any } = { runs: [], streamingRun: null };
      await act(async () => {
        fetchResult = await result.current.fetchRuns();
      });

      expect(fetchResult).toEqual({
        runs: [],
        streamingRun: null,
      });

      expect(result.current.runs).toEqual([]);
      expect(result.current.selectedRun).toBeNull();
    });
  });

  describe("handleVersionChange", () => {
    it("should select the run with matching version", () => {
      const mockRuns = [
        {
          id: 1,
          version: 1,
          status: "completed",
          result: { summary: "Version 1" },
          workflowRunId: "workflow-123",
          additionalInstructions: null,
          createdAt: "2023-01-01T00:00:00Z",
        },
        {
          id: 2,
          version: 2,
          status: "completed",
          result: { summary: "Version 2" },
          workflowRunId: "workflow-456",
          additionalInstructions: null,
          createdAt: "2023-01-02T00:00:00Z",
        },
      ];

      const { result } = renderHook(() => useVideoStatus("test-video-id"));

      // Set initial runs
      act(() => {
        result.current.setRuns(mockRuns);
        result.current.setSelectedRun(mockRuns[0]);
      });

      // Change version
      act(() => {
        result.current.handleVersionChange(2);
      });

      expect(result.current.selectedRun).toEqual(mockRuns[1]);
    });

    it("should not change selection if version not found", () => {
      const mockRuns = [
        {
          id: 1,
          version: 1,
          status: "completed",
          result: { summary: "Version 1" },
          workflowRunId: "workflow-123",
          additionalInstructions: null,
          createdAt: "2023-01-01T00:00:00Z",
        },
      ];

      const { result } = renderHook(() => useVideoStatus("test-video-id"));

      // Set initial runs
      act(() => {
        result.current.setRuns(mockRuns);
        result.current.setSelectedRun(mockRuns[0]);
      });

      // Try to change to non-existent version
      act(() => {
        result.current.handleVersionChange(99);
      });

      // Selection should remain unchanged
      expect(result.current.selectedRun).toEqual(mockRuns[0]);
    });
  });
});
