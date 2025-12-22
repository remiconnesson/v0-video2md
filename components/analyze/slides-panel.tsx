"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useLocalStorage } from "@uidotdev/usehooks";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  HelpCircle,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { createParser, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const parseAsPresence = createParser<boolean>({
  parse: (value) =>
    value === "" || value.toLowerCase() === "true" ? true : null,
  serialize: () => "",
});

const tabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepIndicator } from "@/components/ui/step-indicator";
import type {
  SlideAnalysisState,
  SlideAnalysisStreamEvent,
  SlideData,
  SlideFeedbackData,
  SlideStreamEvent,
  SlidesState,
} from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import { cn } from "@/lib/utils";
import { SlideCard } from "./slide-card";

// Type for storing analysis results per slide/frame
interface SlideAnalysisResultData {
  slideNumber: number;
  framePosition: "first" | "last";
  markdown: string;
}

interface SlidesPanelProps {
  videoId: string;
}

export function SlidesPanel({ videoId }: SlidesPanelProps) {
  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "loading",
    step: 1,
    totalSteps: 4,
    message: "Loading slides...",
    error: null,
    slides: [],
  });

  const [feedbackMap, setFeedbackMap] = useState<
    Map<number, SlideFeedbackData>
  >(new Map());
  const [isUnpickingAll, setIsUnpickingAll] = useState(false);

  // Slide analysis state
  const [analysisState, setAnalysisState] = useState<SlideAnalysisState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
  });
  const [analysisResults, setAnalysisResults] = useState<
    Map<string, SlideAnalysisResultData>
  >(new Map());

  const loadSlidesState = useCallback(async () => {
    setSlidesState((prev) => ({
      ...prev,
      status: "loading",
      message: "Loading slides...",
      error: null,
    }));

    try {
      const response = await fetch(`/api/video/${videoId}/slides`);

      if (!response.ok) {
        throw new Error("Failed to load slides state");
      }

      const data = await response.json();
      const slides: SlideData[] = data.slides ?? [];
      const slidesMessage = `Extracted ${data.totalSlides ?? slides.length} slides`;

      switch (data.status) {
        case "completed": {
          setSlidesState({
            status: "completed",
            step: 4,
            totalSteps: 4,
            message: slidesMessage,
            error: null,
            slides,
          });
          return;
        }
        case "in_progress": {
          setSlidesState({
            status: "extracting",
            step: 2,
            totalSteps: 4,
            message: "Slide extraction in progress...",
            error: null,
            slides,
          });
          return;
        }
        case "pending": {
          setSlidesState({
            status: "extracting",
            step: 1,
            totalSteps: 4,
            message: "Slide extraction in progress...",
            error: null,
            slides,
          });
          return;
        }
        case "failed": {
          setSlidesState({
            status: "error",
            step: 1,
            totalSteps: 4,
            message: "",
            error:
              data.errorMessage ?? "Slide extraction failed. Please try again.",
            slides,
          });
          return;
        }
        default: {
          setSlidesState({
            status: slides.length > 0 ? "completed" : "idle",
            step: slides.length > 0 ? 4 : 1,
            totalSteps: 4,
            message: slides.length > 0 ? slidesMessage : "",
            error: null,
            slides,
          });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load slides.";

      setSlidesState({
        status: "error",
        step: 1,
        totalSteps: 4,
        message: "",
        error: errorMessage,
        slides: [],
      });
    }
  }, [videoId]);

  const loadFeedback = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${videoId}/slides/feedback`);
      if (!response.ok) return;

      const data = await response.json();
      const newMap = new Map<number, SlideFeedbackData>();

      data.feedback.forEach((fb: SlideFeedbackData) => {
        newMap.set(fb.slideNumber, fb);
      });

      setFeedbackMap(newMap);
    } catch (error) {
      console.error("Failed to load slide feedback:", error);
    }
  }, [videoId]);

  const submitFeedback = useCallback(
    async (feedback: SlideFeedbackData) => {
      try {
        // Optimistically update local state
        setFeedbackMap((prev) => {
          const next = new Map(prev);
          next.set(feedback.slideNumber, feedback);
          return next;
        });

        const response = await fetch(`/api/video/${videoId}/slides/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedback),
        });

        if (!response.ok) {
          console.error("Failed to save slide feedback");
          // Reload to sync state
          await loadFeedback();
        }
      } catch (error) {
        console.error("Failed to save slide feedback:", error);
        // Reload to sync state
        await loadFeedback();
      }
    },
    [videoId, loadFeedback],
  );

  const handleUnpickAll = useCallback(async () => {
    if (slidesState.slides.length === 0) return;

    setIsUnpickingAll(true);
    try {
      const updates = slidesState.slides.map((slide) => {
        const existing = feedbackMap.get(slide.slideNumber);
        const base = {
          slideNumber: slide.slideNumber,
          firstFrameHasUsefulContent: null,
          lastFrameHasUsefulContent: null,
          framesSameness: null,
          isFirstFramePicked: false,
          isLastFramePicked: false,
          ...existing,
        };

        return {
          ...base,
          isFirstFramePicked: false,
          isLastFramePicked: false,
        };
      });

      await Promise.all(updates.map((feedback) => submitFeedback(feedback)));
    } finally {
      setIsUnpickingAll(false);
    }
  }, [feedbackMap, slidesState.slides, submitFeedback]);

  const hasPickedFrames = useMemo(
    () =>
      slidesState.slides.some((slide) => {
        const feedback = feedbackMap.get(slide.slideNumber);
        const isFirstPicked = feedback?.isFirstFramePicked ?? false;
        const isLastPicked = feedback?.isLastFramePicked ?? false;

        return isFirstPicked || isLastPicked;
      }),
    [feedbackMap, slidesState.slides],
  );

  const pickedFramesCount = useMemo(
    () =>
      slidesState.slides.reduce((acc, slide) => {
        const feedback = feedbackMap.get(slide.slideNumber);
        const isFirstPicked = feedback?.isFirstFramePicked ?? false;
        const isLastPicked = feedback?.isLastFramePicked ?? false;

        let count = 0;
        if (isFirstPicked) count++;
        if (isLastPicked) count++;
        return acc + count;
      }, 0),
    [feedbackMap, slidesState.slides],
  );

  // Load existing analysis results
  const loadAnalysisResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`);
      if (!response.ok) return;

      const data = await response.json();
      const resultsMap = new Map<string, SlideAnalysisResultData>();

      for (const result of data.results as SlideAnalysisResultData[]) {
        const key = `${result.slideNumber}-${result.framePosition}`;
        resultsMap.set(key, result);
      }

      setAnalysisResults(resultsMap);
    } catch (error) {
      console.error("Failed to load slide analysis results:", error);
    }
  }, [videoId]);

  // Start slide analysis
  const handleAnalyzeSelectedSlides = useCallback(async () => {
    if (!hasPickedFrames) return;

    setAnalysisState({
      status: "streaming",
      progress: 0,
      message: "Starting analysis...",
      error: null,
    });

    try {
      const targets = slidesState.slides.flatMap((slide) => {
        const feedback = feedbackMap.get(slide.slideNumber);
        const results = [];
        if (feedback?.isFirstFramePicked) {
          results.push({
            slideNumber: slide.slideNumber,
            framePosition: "first" as const,
          });
        }
        if (feedback?.isLastFramePicked) {
          results.push({
            slideNumber: slide.slideNumber,
            framePosition: "last" as const,
          });
        }
        return results;
      });

      const response = await fetch(`/api/video/${videoId}/slides/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to start analysis" }));
        throw new Error(errorData.error);
      }

      // Consume SSE stream
      await consumeSSE<SlideAnalysisStreamEvent>(response, {
        progress: (e) => {
          setAnalysisState((prev) => ({
            ...prev,
            status: "streaming",
            progress: e.progress,
            message: e.message,
          }));
        },
        slides_started: () => {
          // Slides started event - handled by SlideAnalysisPanel for detailed streaming
        },
        slide_markdown: (e) => {
          setAnalysisResults((prev) => {
            const next = new Map(prev);
            const key = `${e.slideNumber}-${e.framePosition}`;
            next.set(key, {
              slideNumber: e.slideNumber,
              framePosition: e.framePosition,
              markdown: e.markdown,
            });
            return next;
          });
        },
        complete: () => {
          setAnalysisState({
            status: "completed",
            progress: 100,
            message: "Analysis complete",
            error: null,
          });
        },
        error: (e) => {
          setAnalysisState((prev) => ({
            ...prev,
            status: "error",
            error: e.message,
          }));
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to analyze slides.";

      setAnalysisState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
    }
  }, [videoId, hasPickedFrames, feedbackMap, slidesState.slides]);

  const startExtraction = useCallback(async () => {
    // Set state to extracting
    setSlidesState((prev) => ({
      ...prev,
      status: "extracting",
      step: 1,
      totalSteps: 4,
      message: "Starting slides extraction...",
      error: null,
      slides: [],
    }));

    try {
      const response = await fetch(`/api/video/${videoId}/slides`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "!response.ok and response.json() failed" }));
        throw new Error(errorData.error);
      }

      // Consume SSE stream
      await consumeSSE<SlideStreamEvent>(response, {
        progress: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "extracting",
            step: e.step ?? prev.step,
            totalSteps: e.totalSteps ?? prev.totalSteps,
            message: e.message ?? prev.message,
          }));
        },
        slide: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            slides: [...prev.slides, e.slide],
          }));
        },
        complete: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "completed",
            step: 4,
            totalSteps: 4,
            message: `Extracted ${e.totalSlides} slides`,
            error: null,
          }));
        },
        error: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "error",
            step: 1,
            totalSteps: 4,
            message: "",
            error: e.message,
          }));
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to extract slides.";

      setSlidesState((prev) => ({
        ...prev,
        status: "error",
        step: 1,
        totalSteps: 4,
        message: "",
        error: errorMessage,
      }));
    }
  }, [videoId]);

  // Load feedback and analysis on mount
  useEffect(() => {
    loadSlidesState();
    loadFeedback();
    loadAnalysisResults();
  }, [loadFeedback, loadSlidesState, loadAnalysisResults]);

  // Auto-trigger extraction when in idle state
  useEffect(() => {
    if (slidesState.status === "idle") {
      startExtraction();
    }
  }, [slidesState.status, startExtraction]);

  // Idle state - show loading state while extraction starts
  if (slidesState.status === "idle") {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Starting slides extraction...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (slidesState.status === "loading") {
    return <LoadingState />;
  }

  // Extracting state
  if (slidesState.status === "extracting") {
    return (
      <ExtractingState
        step={slidesState.step}
        totalSteps={slidesState.totalSteps}
        message={slidesState.message}
        slides={slidesState.slides}
        feedbackMap={feedbackMap}
        onSubmitFeedback={submitFeedback}
      />
    );
  }

  // Error state
  if (slidesState.status === "error") {
    return <ErrorState error={slidesState.error} onRetry={startExtraction} />;
  }

  // Completed state - show slides
  return (
    <CompletedState
      totalFramesCount={slidesState.slides.length * 2}
      pickedFramesCount={pickedFramesCount}
      slides={slidesState.slides}
      feedbackMap={feedbackMap}
      onSubmitFeedback={submitFeedback}
      onUnpickAll={handleUnpickAll}
      isUnpickingAll={isUnpickingAll}
      hasPickedFrames={hasPickedFrames}
      onAnalyzeSelectedSlides={handleAnalyzeSelectedSlides}
      analysisState={analysisState}
      hasAnalysisResults={analysisResults.size > 0}
    />
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading slides...</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ExtractingState({
  step,
  totalSteps,
  message,
  slides,
  feedbackMap,
  onSubmitFeedback,
}: {
  step: number;
  totalSteps: number;
  message: string;
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
}) {
  const hasSlidesFound = slides.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Extracting Slides
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <StepIndicator
          currentStep={step}
          totalSteps={totalSteps}
          message={message}
        />

        {hasSlidesFound && (
          <div className="mt-6">
            <p className="text-sm font-medium mb-3">
              {slides.length * 2} frames found so far
            </p>
            <SlideGrid
              slides={slides}
              feedbackMap={feedbackMap}
              onSubmitFeedback={onSubmitFeedback}
              showOnlyPicked={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedState({
  totalFramesCount,
  pickedFramesCount,
  slides,
  feedbackMap,
  onSubmitFeedback,
  onUnpickAll,
  isUnpickingAll,
  hasPickedFrames,
  onAnalyzeSelectedSlides,
  analysisState,
  hasAnalysisResults,
}: {
  totalFramesCount: number;
  pickedFramesCount: number;
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
  onUnpickAll: () => Promise<void>;
  isUnpickingAll: boolean;
  hasPickedFrames: boolean;
  onAnalyzeSelectedSlides: () => Promise<void>;
  analysisState: SlideAnalysisState;
  hasAnalysisResults: boolean;
}) {
  const [showTutorial, setShowTutorial] = useLocalStorage(
    "video2md-slides-tutorial",
    true,
  );
  const [showOnlyPicked, setShowOnlyPicked] = useState(false);
  const [slidesConfirmed, setSlidesConfirmed] = useState(false);
  const [, setQueryState] = useQueryStates(tabQueryConfig);

  const isAnalyzing = analysisState.status === "streaming";
  const isAnalysisComplete =
    analysisState.status === "completed" || hasAnalysisResults;

  // Filter slides based on showOnlyPicked toggle
  const filteredSlides = useMemo(() => {
    if (!showOnlyPicked) return slides;

    return slides.filter((slide) => {
      const feedback = feedbackMap.get(slide.slideNumber);
      return feedback?.isFirstFramePicked || feedback?.isLastFramePicked;
    });
  }, [slides, feedbackMap, showOnlyPicked]);

  const handleNavigateToSuperAnalysis = () => {
    void setQueryState({
      superAnalysis: true,
      slides: null,
      analyze: null,
      slideAnalysis: null,
    });
  };

  return (
    <div className="flex flex-col">
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Frames ({pickedFramesCount}/{totalFramesCount})
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {!showTutorial && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowTutorial(true)}
                  title="Show tutorial"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              )}
              {/* Show only picked toggle */}
              <Button
                variant={showOnlyPicked ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowOnlyPicked(!showOnlyPicked)}
                className="gap-1.5"
                disabled={!hasPickedFrames}
              >
                {showOnlyPicked ? (
                  <>
                    <Eye className="h-4 w-4" />
                    Show all
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Show picked only
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {/* Analysis progress indicator */}
        {isAnalyzing && (
          <CardContent className="pt-0 pb-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm">{analysisState.message}</span>
              <span className="text-sm text-muted-foreground ml-auto">
                {analysisState.progress}%
              </span>
            </div>
          </CardContent>
        )}

        {/* Analysis error indicator */}
        {analysisState.status === "error" && analysisState.error && (
          <CardContent className="pt-0 pb-4">
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {analysisState.error}
            </div>
          </CardContent>
        )}

        <CardContent
          className={cn(
            isAnalyzing || analysisState.status === "error" ? "pt-0" : "",
            "pb-32", // Add padding for sticky footer
          )}
        >
          {showTutorial && (
            <Card className="mb-6 bg-primary/[0.02] border-primary/20 shadow-none relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                  onClick={() => setShowTutorial(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <HelpCircle className="h-4 w-4" />
                  How this page works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Pick the slides you&apos;d like to include in the final
                  analysis. Changes are saved automatically.
                </p>
                <p>
                  Once you&apos;ve picked your slides, confirm your selection
                  below and click &quot;Analyze Selected Slides&quot; to
                  generate the Super Analysis.
                </p>
                <p>
                  You can use the &quot;Show picked only&quot; toggle to review
                  just your selected frames.
                </p>
                <div className="pt-2 flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowTutorial(false)}
                    className="text-xs h-8"
                  >
                    Hide tutorial
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredSlides.length === 0 && showOnlyPicked ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No slides have been picked yet.</p>
              <p className="text-sm mt-1">
                Toggle &quot;Show all&quot; to see all slides and pick some.
              </p>
            </div>
          ) : (
            <SlideGrid
              slides={filteredSlides}
              feedbackMap={feedbackMap}
              onSubmitFeedback={onSubmitFeedback}
              showOnlyPicked={showOnlyPicked}
            />
          )}
        </CardContent>
      </Card>

      {/* Sticky footer with actions */}
      <StickyActionsFooter
        pickedFramesCount={pickedFramesCount}
        slidesConfirmed={slidesConfirmed}
        onSlidesConfirmedChange={setSlidesConfirmed}
        hasPickedFrames={hasPickedFrames}
        onUnpickAll={onUnpickAll}
        isUnpickingAll={isUnpickingAll}
        onAnalyzeSelectedSlides={onAnalyzeSelectedSlides}
        analysisState={analysisState}
        isAnalysisComplete={isAnalysisComplete}
        onNavigateToSuperAnalysis={handleNavigateToSuperAnalysis}
      />
    </div>
  );
}

// ============================================================================
// Sticky Actions Footer
// ============================================================================

function StickyActionsFooter({
  pickedFramesCount,
  slidesConfirmed,
  onSlidesConfirmedChange,
  hasPickedFrames,
  onUnpickAll,
  isUnpickingAll,
  onAnalyzeSelectedSlides,
  analysisState,
  isAnalysisComplete,
  onNavigateToSuperAnalysis,
}: {
  pickedFramesCount: number;
  slidesConfirmed: boolean;
  onSlidesConfirmedChange: (confirmed: boolean) => void;
  hasPickedFrames: boolean;
  onUnpickAll: () => Promise<void>;
  isUnpickingAll: boolean;
  onAnalyzeSelectedSlides: () => Promise<void>;
  analysisState: SlideAnalysisState;
  isAnalysisComplete: boolean;
  onNavigateToSuperAnalysis: () => void;
}) {
  const isAnalyzing = analysisState.status === "streaming";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-5xl px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left side - Confirmation checkbox */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={slidesConfirmed}
              onChange={(e) => onSlidesConfirmedChange(e.target.checked)}
              disabled={!hasPickedFrames || isAnalyzing}
              className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <span
              className={cn(
                "text-sm",
                !hasPickedFrames && "text-muted-foreground",
              )}
            >
              {hasPickedFrames
                ? `These ${pickedFramesCount} slides look good to me`
                : "Pick some slides first"}
            </span>
          </label>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onUnpickAll}
              disabled={!hasPickedFrames || isUnpickingAll || isAnalyzing}
            >
              {isUnpickingAll ? "Unpicking..." : "Unpick all"}
            </Button>

            {isAnalysisComplete ? (
              <Button
                size="sm"
                onClick={onNavigateToSuperAnalysis}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Go to Super Analysis
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onAnalyzeSelectedSlides}
                disabled={!slidesConfirmed || isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Analyze Selected Slides"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Slide Grid with Virtual Scrolling
// ============================================================================

function SlideGrid({
  slides,
  feedbackMap,
  onSubmitFeedback,
  showOnlyPicked,
}: {
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
  showOnlyPicked: boolean;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: slides.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 500, // Estimated height of each slide card
    overscan: 2, // Number of items to render outside of the visible area
  });

  return (
    <div
      ref={parentRef}
      className="h-[400px] md:h-[600px] overflow-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const slide = slides[virtualItem.index];
          const feedback = feedbackMap.get(slide.slideNumber);
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-6">
                <SlideCard
                  slide={slide}
                  initialFeedback={feedback}
                  onSubmitFeedback={onSubmitFeedback}
                  showOnlyPickedFrames={showOnlyPicked}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
