import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTranscriptFetch } from "./use-transcript-fetch";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock consumeSSE
vi.mock("@/lib/sse", () => ({
  consumeSSE: vi.fn(),
}));

describe("useTranscriptFetch", () => {
  const mockSetSlidesState = vi.fn();
  const mockSetAnalysisState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkVideoStatus", () => {
    it("should return not_found when video doesn't exist", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      let statusResult: {
        status: "not_found" | "processing" | "ready";
        hasStreamingAnalysis: boolean;
      } = { status: "not_found", hasStreamingAnalysis: false };
      await act(async () => {
        statusResult = await result.current.checkVideoStatus();
      });

      expect(statusResult).toEqual({
        status: "not_found",
        hasStreamingAnalysis: false,
      });
    });

    it("should return ready status when video exists and is ready", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ready",
            video: {
              title: "Test Video",
              channelName: "Test Channel",
              thumbnail: "test-thumbnail.jpg",
            },
          }),
      });

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      let statusResult: {
        status: "not_found" | "processing" | "ready";
        hasStreamingAnalysis: boolean;
      } = { status: "not_found", hasStreamingAnalysis: false };
      await act(async () => {
        statusResult = await result.current.checkVideoStatus();
      });

      expect(statusResult).toEqual({
        status: "ready",
        hasStreamingAnalysis: false,
      });
    });

    it("should return processing status when video is being processed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "processing",
          }),
      });

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      let statusResult: {
        status: "not_found" | "processing" | "ready";
        hasStreamingAnalysis: boolean;
      } = { status: "not_found", hasStreamingAnalysis: false };
      await act(async () => {
        statusResult = await result.current.checkVideoStatus();
      });

      expect(statusResult).toEqual({
        status: "processing",
        hasStreamingAnalysis: false,
      });
    });

    it("should handle network errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      let statusResult: {
        status: "not_found" | "processing" | "ready";
        hasStreamingAnalysis: boolean;
      } = { status: "not_found", hasStreamingAnalysis: false };
      await act(async () => {
        statusResult = await result.current.checkVideoStatus();
      });

      expect(statusResult).toEqual({
        status: "not_found",
        hasStreamingAnalysis: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to check video status:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("handleFetchTranscript", () => {
    it("should set page status to fetching_transcript and start processing", async () => {
      const { consumeSSE } = await import("@/lib/sse");
      const mockConsumeSSE = vi.mocked(consumeSSE);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      // Mock successful SSE consumption that completes
      mockConsumeSSE.mockImplementationOnce(async (_response, handlers) => {
        // Simulate successful completion
        if (handlers.complete) {
          await handlers.complete({
            type: "complete",
            source: "unified",
            runId: 123,
            video: { title: "Test Video", channelName: "Test Channel" },
          });
        }
      });

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      await act(async () => {
        result.current.handleFetchTranscript();
      });

      expect(result.current.pageStatus).toBe("ready");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/process",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        }),
      );
      expect(mockConsumeSSE).toHaveBeenCalled();
    });
  });

  describe("startProcessing", () => {
    it("should make API call to start processing", async () => {
      const { consumeSSE } = await import("@/lib/sse");
      const mockConsumeSSE = vi.mocked(consumeSSE);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      // Mock successful SSE consumption that completes
      mockConsumeSSE.mockImplementationOnce(async (_response, handlers) => {
        // Simulate successful completion
        if (handlers.complete) {
          await handlers.complete({
            type: "complete",
            source: "unified",
            runId: 123,
            video: { title: "Test Video", channelName: "Test Channel" },
          });
        }
      });

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      await act(async () => {
        await result.current.startProcessing();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/process",
        expect.objectContaining({
          method: "POST",
          signal: expect.any(AbortSignal),
        }),
      );
      expect(mockConsumeSSE).toHaveBeenCalled();
    });

    it("should handle processing API errors", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() =>
        useTranscriptFetch(
          "test-video-id",
          mockSetSlidesState,
          mockSetAnalysisState,
        ),
      );

      await act(async () => {
        await result.current.startProcessing();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to start processing:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
