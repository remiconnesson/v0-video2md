"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ImageIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StepIndicator } from "@/components/ui/step-indicator";
import type {
  SlideData,
  SlideFeedbackData,
  SlideStreamEvent,
  SlidesState,
} from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import { SlideCard } from "./slide-card";
import { SlideGridTab } from "./slide-grid-tab";

type SlidesPanelView = "curation" | "grid";

interface SlidesPanelProps {
  videoId: string;
  view?: SlidesPanelView;
}

export function SlidesPanel({ videoId, view = "curation" }: SlidesPanelProps) {
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
          isFirstFramePicked: true,
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
        const isFirstPicked = feedback?.isFirstFramePicked ?? true;
        const isLastPicked = feedback?.isLastFramePicked ?? false;

        return isFirstPicked || isLastPicked;
      }),
    [feedbackMap, slidesState.slides],
  );

  const pickedFramesCount = useMemo(
    () =>
      slidesState.slides.reduce((acc, slide) => {
        const feedback = feedbackMap.get(slide.slideNumber);
        const isFirstPicked = feedback?.isFirstFramePicked ?? true;
        const isLastPicked = feedback?.isLastFramePicked ?? false;

        let count = 0;
        if (isFirstPicked) count++;
        if (isLastPicked) count++;
        return acc + count;
      }, 0),
    [feedbackMap, slidesState.slides],
  );

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

  // Load feedback on mount
  useEffect(() => {
    loadSlidesState();
    loadFeedback();
  }, [loadFeedback, loadSlidesState]);

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
      view={view}
      onUnpickAll={handleUnpickAll}
      isUnpickingAll={isUnpickingAll}
      hasPickedFrames={hasPickedFrames}
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
  view,
  onUnpickAll,
  isUnpickingAll,
  hasPickedFrames,
}: {
  totalFramesCount: number;
  pickedFramesCount: number;
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
  view: SlidesPanelView;
  onUnpickAll: () => Promise<void>;
  isUnpickingAll: boolean;
  hasPickedFrames: boolean;
}) {
  const [showTutorial, setShowTutorial] = useState(false);
  const slidesLabel =
    view === "curation"
      ? `Frames (${pickedFramesCount}/${totalFramesCount})`
      : `Picked Frames (${pickedFramesCount})`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {slidesLabel}
          </span>
          {view === "curation" && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTutorial((prev) => !prev)}
              >
                {showTutorial ? "Hide tutorial" : "Show tutorial"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onUnpickAll}
                disabled={!hasPickedFrames || isUnpickingAll}
              >
                {isUnpickingAll ? "Unpicking..." : "Unpick all frames"}
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {view === "curation" && showTutorial && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">How this page works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                In this page you can select which slides you'd like to keep for
                this video. Interactions immediately save the choice in the
                database (there&apos;s no save button).
              </p>
              <p>
                You can also help build a dataset to improve the service. If a
                frame doesn&apos;t have useful content you can mark it as such
                (or the opposite) to label images for training and dev purposes.
              </p>
              <p>
                We&apos;re improving the slide detection algorithm, so we show
                the first and last frame of each segment. If the algorithm were
                perfect, the first and last frame would be identical in terms of
                useful content. By indicating whether they contain useful
                content and how similar they are, you help us close that gap.
              </p>
              <p>You don&apos;t need to annotate everything—10% is enough.</p>
              <div className="space-y-2">
                <p className="font-medium text-foreground">Order of priority</p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    Pick the best slides (shown in the{" "}
                    <Link
                      href="?slides"
                      className="text-primary underline underline-offset-4"
                    >
                      Slide Curation tab
                    </Link>
                    ) that will be used for AI slide-to-markdown extraction.
                  </li>
                  <li>
                    Annotate some slides so we can build a dataset to improve
                    slide detection quality and eventually remove the need for
                    manual selection.
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
        {view === "curation" ? (
          <SlideGrid
            slides={slides}
            feedbackMap={feedbackMap}
            onSubmitFeedback={onSubmitFeedback}
          />
        ) : (
          <SlideGridTab slides={slides} feedbackMap={feedbackMap} />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Slide Grid with Virtual Scrolling
// ============================================================================

function SlideGrid({
  slides,
  feedbackMap,
  onSubmitFeedback,
}: {
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
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
      className="h-[600px] overflow-auto"
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
                  initialFeedback={feedbackMap.get(slide.slideNumber)}
                  onSubmitFeedback={onSubmitFeedback}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
