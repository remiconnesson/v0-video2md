import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSlidesLoader } from "./use-slides-loader";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useSlidesLoader", () => {
  const mockSetSlidesState = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadExistingSlides", () => {
    it("should load slides successfully", async () => {
      const mockSlides = [
        {
          slideIndex: 0,
          frameId: "frame-1",
          startTime: 0,
          endTime: 10,
          duration: 10,
          firstFrameImageUrl: "url1",
          firstFrameHasText: true,
          firstFrameTextConfidence: 0.9,
          firstFrameIsDuplicate: false,
          firstFrameDuplicateOfSegmentId: null,
          firstFrameDuplicateOfFramePosition: null,
          firstFrameSkipReason: null,
          lastFrameImageUrl: "url2",
          lastFrameHasText: false,
          lastFrameTextConfidence: 0.1,
          lastFrameIsDuplicate: false,
          lastFrameDuplicateOfSegmentId: null,
          lastFrameDuplicateOfFramePosition: null,
          lastFrameSkipReason: null,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            slides: mockSlides,
          }),
      });

      const { result } = renderHook(() =>
        useSlidesLoader("test-video-id", mockSetSlidesState),
      );

      await act(async () => {
        await result.current.loadExistingSlides();
      });

      expect(mockSetSlidesState).toHaveBeenCalledWith({
        status: "completed",
        progress: 100,
        message: "1 slides loaded",
        error: null,
        slides: mockSlides,
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/video/test-video-id/slides");
    });

    it("should handle extraction in progress", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "in_progress",
            slides: [],
          }),
      });

      const { result } = renderHook(() =>
        useSlidesLoader("test-video-id", mockSetSlidesState),
      );

      await act(async () => {
        await result.current.loadExistingSlides();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/video/test-video-id/slides");
    });

    it("should handle failed extraction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "failed",
            errorMessage: "Extraction failed due to network error",
            slides: [],
          }),
      });

      const { result } = renderHook(() =>
        useSlidesLoader("test-video-id", mockSetSlidesState),
      );

      await act(async () => {
        await result.current.loadExistingSlides();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/video/test-video-id/slides");
    });

    it("should handle empty slides array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            slides: [],
          }),
      });

      const { result } = renderHook(() =>
        useSlidesLoader("test-video-id", mockSetSlidesState),
      );

      await act(async () => {
        await result.current.loadExistingSlides();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/video/test-video-id/slides");
    });

    it("should handle network errors", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() =>
        useSlidesLoader("test-video-id", mockSetSlidesState),
      );

      await act(async () => {
        await result.current.loadExistingSlides();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load existing slides:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const { result } = renderHook(() =>
        useSlidesLoader("test-video-id", mockSetSlidesState),
      );

      await act(async () => {
        await result.current.loadExistingSlides();
      });

      // Should set error state when fetch fails with ok: false
      expect(mockSetSlidesState).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});
