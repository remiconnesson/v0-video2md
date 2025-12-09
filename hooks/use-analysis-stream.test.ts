import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAnalysisStream } from "./use-analysis-stream";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock consumeSSE
vi.mock("@/lib/sse", () => ({
  consumeSSE: vi.fn(),
}));

describe("useAnalysisStream", () => {
  const mockSetAnalysisState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startAnalysisRun", () => {
    it("should start analysis and consume stream successfully", async () => {
      const { consumeSSE } = await import("@/lib/sse");
      const mockConsumeSSE = vi.mocked(consumeSSE);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });
      mockConsumeSSE.mockResolvedValueOnce();

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.startAnalysisRun();
      });

      expect(mockSetAnalysisState).toHaveBeenCalledWith({
        status: "running",
        phase: "starting",
        message: "Starting analysis...",
        result: null,
        runId: null,
        error: null,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalInstructions: undefined }),
        },
      );

      expect(mockConsumeSSE).toHaveBeenCalled();
    });

    it("should handle additional instructions", async () => {
      const { consumeSSE } = await import("@/lib/sse");
      const mockConsumeSSE = vi.mocked(consumeSSE);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });
      mockConsumeSSE.mockResolvedValueOnce();

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.startAnalysisRun("Focus on technical details");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            additionalInstructions: "Focus on technical details",
          }),
        },
      );
    });

    it("should handle analysis start API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.startAnalysisRun();
      });

      // Should not throw, error handling is done via state updates
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.startAnalysisRun();
      });

      // Should not throw, error handling is done via state updates
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("resumeAnalysisStream", () => {
    it("should resume analysis stream successfully", async () => {
      const { consumeSSE } = await import("@/lib/sse");
      const mockConsumeSSE = vi.mocked(consumeSSE);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });
      mockConsumeSSE.mockResolvedValueOnce();

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.resumeAnalysisStream();
      });

      expect(mockSetAnalysisState).toHaveBeenCalledWith({
        status: "running",
        phase: "resuming",
        message: "Reconnecting to analysis...",
        result: null,
        runId: null,
        error: null,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/analyze/resume",
      );
      expect(mockConsumeSSE).toHaveBeenCalled();
    });

    it("should handle resume when analysis is completed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ completed: true }),
      });

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.resumeAnalysisStream();
      });

      expect(mockSetAnalysisState).toHaveBeenNthCalledWith(1, {
        status: "running",
        phase: "resuming",
        message: "Reconnecting to analysis...",
        result: null,
        runId: null,
        error: null,
      });

      expect(mockSetAnalysisState).toHaveBeenNthCalledWith(2, {
        status: "idle",
        phase: "",
        message: "",
        result: null,
        runId: null,
        error: null,
      });
    });

    it("should handle resume API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.resumeAnalysisStream();
      });

      // Should not throw, error handling is done via state updates
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/video/test-video-id/analyze/resume",
      );
    });
  });

  describe("consumeAnalysisStream", () => {
    it("should consume analysis stream events", async () => {
      const { consumeSSE } = await import("@/lib/sse");
      const mockConsumeSSE = vi.mocked(consumeSSE);
      const mockResponse = { ok: true } as Response;

      mockConsumeSSE.mockResolvedValueOnce();

      const { result } = renderHook(() =>
        useAnalysisStream("test-video-id", mockSetAnalysisState),
      );

      await act(async () => {
        await result.current.consumeAnalysisStream(mockResponse);
      });

      expect(mockConsumeSSE).toHaveBeenCalledWith(mockResponse, {
        progress: expect.any(Function),
        partial: expect.any(Function),
        result: expect.any(Function),
        complete: expect.any(Function),
        error: expect.any(Function),
      });
    });
  });
});
