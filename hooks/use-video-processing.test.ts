import { describe, expect, it } from "vitest";
import type { SlideData } from "@/lib/slides-types";
import {
  type AnalysisRun,
  videoProcessingReducer,
} from "./use-video-processing";

// ============================================================================
// Test Fixtures
// ============================================================================

// Use explicit State type to avoid TypeScript narrowing issues
interface State {
  status: "loading" | "no_video" | "processing" | "ready" | "error";
  video: {
    title: string;
    channelName?: string;
    thumbnail?: string;
  } | null;
  runs: AnalysisRun[];
  selectedRunId: number | null;
  processingProgress: {
    phase: "fetching" | "analyzing" | "saving";
    message: string;
    progress: number;
  } | null;
  analysisProgress: {
    phase: string;
    message: string;
    partial: unknown | null;
  } | null;
  slides: SlideData[];
  slidesProgress: {
    progress: number;
    message: string;
  } | null;
  error: string | null;
}

const initialState: State = {
  status: "loading",
  video: null,
  runs: [],
  selectedRunId: null,
  processingProgress: null,
  analysisProgress: null,
  slides: [],
  slidesProgress: null,
  error: null,
};

const mockVideo = {
  title: "Test Video",
  channelName: "Test Channel",
  thumbnail: "https://example.com/thumb.jpg",
};

const mockRun = {
  id: 1,
  version: 1,
  status: "completed",
  result: { summary: "Test summary" },
  workflowRunId: "workflow-123",
  additionalInstructions: null,
  createdAt: "2024-01-01T00:00:00Z",
};

const mockSlide: SlideData = {
  slideIndex: 0,
  frameId: "frame-1",
  startTime: 0,
  endTime: 10,
  duration: 10,
  firstFrameImageUrl: "https://example.com/first.jpg",
  firstFrameHasText: true,
  firstFrameTextConfidence: 90,
  firstFrameIsDuplicate: false,
  firstFrameDuplicateOfSegmentId: null,
  firstFrameDuplicateOfFramePosition: null,
  firstFrameSkipReason: null,
  lastFrameImageUrl: "https://example.com/last.jpg",
  lastFrameHasText: false,
  lastFrameTextConfidence: 10,
  lastFrameIsDuplicate: false,
  lastFrameDuplicateOfSegmentId: null,
  lastFrameDuplicateOfFramePosition: null,
  lastFrameSkipReason: null,
};

// ============================================================================
// Initialization Tests
// ============================================================================

describe("videoProcessingReducer - Initialization", () => {
  it("should handle INIT_START", () => {
    const state = videoProcessingReducer(
      { ...initialState, status: "ready", error: "old error" },
      { type: "INIT_START" },
    );

    expect(state.status).toBe("loading");
    expect(state.error).toBeNull();
  });

  it("should handle INIT_NOT_FOUND", () => {
    const state = videoProcessingReducer(initialState, {
      type: "INIT_NOT_FOUND",
    });

    expect(state.status).toBe("no_video");
  });

  it("should handle INIT_READY with all data", () => {
    const state = videoProcessingReducer(initialState, {
      type: "INIT_READY",
      video: mockVideo,
      runs: [mockRun],
      slides: [mockSlide],
      selectedRunId: 1,
    });

    expect(state.status).toBe("ready");
    expect(state.video).toEqual(mockVideo);
    expect(state.runs).toHaveLength(1);
    expect(state.slides).toHaveLength(1);
    expect(state.selectedRunId).toBe(1);
  });

  it("should handle INIT_READY with empty data", () => {
    const state = videoProcessingReducer(initialState, {
      type: "INIT_READY",
      video: mockVideo,
      runs: [],
      slides: [],
      selectedRunId: null,
    });

    expect(state.status).toBe("ready");
    expect(state.video).toEqual(mockVideo);
    expect(state.runs).toHaveLength(0);
    expect(state.slides).toHaveLength(0);
    expect(state.selectedRunId).toBeNull();
  });
});

// ============================================================================
// Processing Tests (transcript + analysis via /process)
// ============================================================================

describe("videoProcessingReducer - Processing", () => {
  it("should handle PROCESS_START", () => {
    const state = videoProcessingReducer(
      { ...initialState, status: "no_video" },
      { type: "PROCESS_START" },
    );

    expect(state.status).toBe("processing");
    expect(state.processingProgress).toEqual({
      phase: "fetching",
      message: "Connecting to YouTube...",
      progress: 10,
    });
    expect(state.slidesProgress).toEqual({
      progress: 0,
      message: "Starting slides extraction...",
    });
    expect(state.error).toBeNull();
  });

  it("should reset slides array on PROCESS_START", () => {
    const state = videoProcessingReducer(
      { ...initialState, status: "ready", slides: [mockSlide] },
      { type: "PROCESS_START" },
    );

    expect(state.slides).toEqual([]);
  });

  it("should handle PROCESS_TRANSCRIPT_PROGRESS", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "processing",
        processingProgress: { phase: "fetching", message: "", progress: 10 },
      },
      {
        type: "PROCESS_TRANSCRIPT_PROGRESS",
        progress: 50,
        message: "Fetching transcript...",
      },
    );

    expect(state.processingProgress).toEqual({
      phase: "fetching",
      message: "Fetching transcript...",
      progress: 50,
    });
  });

  it("should handle PROCESS_ANALYSIS_PROGRESS", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "processing",
        processingProgress: { phase: "fetching", message: "", progress: 80 },
      },
      {
        type: "PROCESS_ANALYSIS_PROGRESS",
        phase: "analyzing",
        message: "Running AI analysis...",
      },
    );

    expect(state.processingProgress?.phase).toBe("analyzing");
    expect(state.processingProgress?.message).toBe("Running AI analysis...");
    expect(state.analysisProgress).toEqual({
      phase: "analyzing",
      message: "Running AI analysis...",
      partial: null,
    });
  });

  it("should handle PROCESS_ANALYSIS_PARTIAL", () => {
    const partialData = { summary: "Partial summary..." };
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "processing",
        analysisProgress: { phase: "analyzing", message: "", partial: null },
      },
      { type: "PROCESS_ANALYSIS_PARTIAL", data: partialData },
    );

    expect(state.analysisProgress?.partial).toEqual(partialData);
  });

  it("should handle PROCESS_COMPLETE", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "processing",
        processingProgress: { phase: "analyzing", message: "", progress: 90 },
        analysisProgress: { phase: "analyzing", message: "", partial: {} },
      },
      { type: "PROCESS_COMPLETE", video: mockVideo, runId: 1 },
    );

    expect(state.status).toBe("ready");
    expect(state.video).toEqual(mockVideo);
    expect(state.processingProgress).toBeNull();
    expect(state.analysisProgress).toBeNull();
  });
});

// ============================================================================
// Standalone Analysis Tests (re-runs via /analyze)
// ============================================================================

describe("videoProcessingReducer - Standalone Analysis", () => {
  it("should handle ANALYSIS_START", () => {
    const state = videoProcessingReducer(
      { ...initialState, status: "ready", error: "old error" },
      { type: "ANALYSIS_START" },
    );

    expect(state.analysisProgress).toEqual({
      phase: "starting",
      message: "Starting analysis...",
      partial: null,
    });
    expect(state.error).toBeNull();
  });

  it("should handle ANALYSIS_PROGRESS", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "ready",
        analysisProgress: { phase: "starting", message: "", partial: null },
      },
      {
        type: "ANALYSIS_PROGRESS",
        phase: "analyzing",
        message: "Processing...",
      },
    );

    expect(state.analysisProgress?.phase).toBe("analyzing");
    expect(state.analysisProgress?.message).toBe("Processing...");
  });

  it("should handle ANALYSIS_PARTIAL and preserve existing partial", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "ready",
        analysisProgress: {
          phase: "analyzing",
          message: "Processing...",
          partial: { old: "data" },
        },
      },
      { type: "ANALYSIS_PARTIAL", data: { new: "data" } },
    );

    expect(state.analysisProgress?.partial).toEqual({ new: "data" });
  });

  it("should handle ANALYSIS_PARTIAL when no existing progress", () => {
    const state = videoProcessingReducer(
      { ...initialState, status: "ready" },
      { type: "ANALYSIS_PARTIAL", data: { some: "data" } },
    );

    expect(state.analysisProgress).toEqual({
      phase: "analyzing",
      message: "",
      partial: { some: "data" },
    });
  });

  it("should handle ANALYSIS_COMPLETE", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "ready",
        analysisProgress: { phase: "analyzing", message: "", partial: {} },
      },
      { type: "ANALYSIS_COMPLETE", runId: 123 },
    );

    expect(state.analysisProgress).toBeNull();
  });
});

// ============================================================================
// Slides Tests
// ============================================================================

describe("videoProcessingReducer - Slides", () => {
  it("should handle SLIDE_RECEIVED and accumulate slides", () => {
    const slide2: SlideData = {
      ...mockSlide,
      slideIndex: 1,
      frameId: "frame-2",
    };

    let state = videoProcessingReducer(
      { ...initialState, slides: [] },
      { type: "SLIDE_RECEIVED", slide: mockSlide },
    );

    expect(state.slides).toHaveLength(1);
    expect(state.slides[0].slideIndex).toBe(0);

    state = videoProcessingReducer(state, {
      type: "SLIDE_RECEIVED",
      slide: slide2,
    });

    expect(state.slides).toHaveLength(2);
    expect(state.slides[1].slideIndex).toBe(1);
  });

  it("should handle SLIDES_PROGRESS", () => {
    const state = videoProcessingReducer(initialState, {
      type: "SLIDES_PROGRESS",
      progress: 50,
      message: "Extracting frames...",
    });

    expect(state.slidesProgress).toEqual({
      progress: 50,
      message: "Extracting frames...",
    });
  });

  it("should handle SLIDES_COMPLETE", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        slidesProgress: { progress: 90, message: "Almost done..." },
      },
      { type: "SLIDES_COMPLETE", totalSlides: 10 },
    );

    expect(state.slidesProgress).toBeNull();
  });
});

// ============================================================================
// Version Selection Tests
// ============================================================================

describe("videoProcessingReducer - Version Selection", () => {
  it("should handle SELECT_RUN", () => {
    const state = videoProcessingReducer(
      { ...initialState, runs: [mockRun], selectedRunId: null },
      { type: "SELECT_RUN", runId: 1 },
    );

    expect(state.selectedRunId).toBe(1);
  });

  it("should handle RUNS_REFRESHED", () => {
    const run2 = { ...mockRun, id: 2, version: 2 };
    const state = videoProcessingReducer(
      { ...initialState, runs: [mockRun], selectedRunId: 1 },
      { type: "RUNS_REFRESHED", runs: [mockRun, run2] },
    );

    expect(state.runs).toHaveLength(2);
    expect(state.selectedRunId).toBe(1); // Preserved
  });

  it("should handle RUNS_REFRESHED with selectRunId", () => {
    const run2 = { ...mockRun, id: 2, version: 2 };
    const state = videoProcessingReducer(
      { ...initialState, runs: [mockRun], selectedRunId: 1 },
      { type: "RUNS_REFRESHED", runs: [mockRun, run2], selectRunId: 2 },
    );

    expect(state.runs).toHaveLength(2);
    expect(state.selectedRunId).toBe(2); // Updated
  });
});

// ============================================================================
// Error Tests
// ============================================================================

describe("videoProcessingReducer - Errors", () => {
  it("should handle ERROR during processing", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "processing",
        processingProgress: { phase: "fetching", message: "", progress: 50 },
      },
      { type: "ERROR", error: "Network error", source: "process" },
    );

    expect(state.status).toBe("no_video");
    expect(state.processingProgress).toBeNull();
    expect(state.error).toBe("Network error");
  });

  it("should handle ERROR during analysis (keep ready status)", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "ready",
        analysisProgress: { phase: "analyzing", message: "", partial: null },
      },
      { type: "ERROR", error: "Analysis failed", source: "analysis" },
    );

    expect(state.status).toBe("ready"); // Stays ready
    expect(state.analysisProgress).toBeNull();
    expect(state.error).toBe("Analysis failed");
  });

  it("should handle ERROR for slides without affecting status", () => {
    const state = videoProcessingReducer(
      {
        ...initialState,
        status: "ready",
        slidesProgress: { progress: 50, message: "Extracting..." },
      },
      { type: "ERROR", error: "Slide extraction failed", source: "slides" },
    );

    expect(state.status).toBe("ready"); // Unchanged
    expect(state.slidesProgress).toBeNull();
    expect(state.error).toBe("Slide extraction failed");
  });
});

// ============================================================================
// SET_SLIDES_STATE Tests (backward compatibility)
// ============================================================================

describe("videoProcessingReducer - SET_SLIDES_STATE", () => {
  it("should replace slides array", () => {
    const newSlides = [mockSlide, { ...mockSlide, slideIndex: 1 }];
    const state = videoProcessingReducer(
      { ...initialState, slides: [mockSlide] },
      { type: "SET_SLIDES_STATE", slides: newSlides },
    );

    expect(state.slides).toHaveLength(2);
    expect(state.slides).toEqual(newSlides);
  });
});

// ============================================================================
// State Transition Flow Tests
// ============================================================================

describe("videoProcessingReducer - Full Flows", () => {
  it("should handle complete processing flow", () => {
    let state: State = initialState;

    // Start
    state = videoProcessingReducer(state, { type: "INIT_START" });
    expect(state.status).toBe("loading");

    // Video not found
    state = videoProcessingReducer(state, { type: "INIT_NOT_FOUND" });
    expect(state.status).toBe("no_video");

    // User clicks fetch
    state = videoProcessingReducer(state, { type: "PROCESS_START" });
    expect(state.status).toBe("processing");

    // Transcript progress
    state = videoProcessingReducer(state, {
      type: "PROCESS_TRANSCRIPT_PROGRESS",
      progress: 50,
      message: "Fetching...",
    });
    expect(state.processingProgress?.progress).toBe(50);

    // Analysis starts
    state = videoProcessingReducer(state, {
      type: "PROCESS_ANALYSIS_PROGRESS",
      phase: "analyzing",
      message: "Analyzing...",
    });
    expect(state.analysisProgress?.phase).toBe("analyzing");

    // Partial result
    state = videoProcessingReducer(state, {
      type: "PROCESS_ANALYSIS_PARTIAL",
      data: { summary: "partial" },
    });
    expect(state.analysisProgress?.partial).toEqual({ summary: "partial" });

    // Complete
    state = videoProcessingReducer(state, {
      type: "PROCESS_COMPLETE",
      video: mockVideo,
      runId: 1,
    });
    expect(state.status).toBe("ready");
    expect(state.video).toEqual(mockVideo);
  });

  it("should handle re-run analysis flow", () => {
    let state: State = {
      ...initialState,
      status: "ready",
      video: mockVideo,
      runs: [mockRun],
      selectedRunId: 1,
    };

    // Start rerun
    state = videoProcessingReducer(state, { type: "ANALYSIS_START" });
    expect(state.analysisProgress?.phase).toBe("starting");

    // Progress
    state = videoProcessingReducer(state, {
      type: "ANALYSIS_PROGRESS",
      phase: "analyzing",
      message: "Processing...",
    });

    // Partial
    state = videoProcessingReducer(state, {
      type: "ANALYSIS_PARTIAL",
      data: { summary: "new analysis" },
    });
    expect(state.analysisProgress?.partial).toEqual({
      summary: "new analysis",
    });

    // Complete
    state = videoProcessingReducer(state, {
      type: "ANALYSIS_COMPLETE",
      runId: 2,
    });
    expect(state.analysisProgress).toBeNull();

    // Runs refreshed
    const run2 = { ...mockRun, id: 2, version: 2 };
    state = videoProcessingReducer(state, {
      type: "RUNS_REFRESHED",
      runs: [mockRun, run2],
      selectRunId: 2,
    });
    expect(state.runs).toHaveLength(2);
    expect(state.selectedRunId).toBe(2);
  });
});
