"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ImageIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  SlideData,
  SlideFeedbackData,
  SlideStreamEvent,
  SlidesState,
} from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import { SlideCard } from "./slide-card";

interface SlidesPanelProps {
  videoId: string;
}

export function SlidesPanel({ videoId }: SlidesPanelProps) {
  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "loading",
    progress: 0,
    message: "Loading slides...",
    error: null,
    slides: [],
  });

  const [feedbackMap, setFeedbackMap] = useState<
    Map<number, SlideFeedbackData>
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
            progress: 100,
            message: slidesMessage,
            error: null,
            slides,
          });
          return;
        }
        case "in_progress":
        case "pending": {
          setSlidesState({
            status: "extracting",
            progress: 0,
            message: "Slide extraction in progress...",
            error: null,
            slides,
          });
          return;
        }
        case "failed": {
          setSlidesState({
            status: "error",
            progress: 0,
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
            progress: slides.length > 0 ? 100 : 0,
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
        progress: 0,
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

  const startExtraction = useCallback(async () => {
    // Set state to extracting
    setSlidesState((prev) => ({
      ...prev,
      status: "extracting",
      progress: 0,
      message: "Starting slides extraction...",
      error: null,
      slides: [],
    }));

    try {
      const response = await fetch(`/api/video/${videoId}/slides?force=true`, {
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
            progress: e.progress ?? prev.progress,
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
            progress: 100,
            message: `Extracted ${e.totalSlides} slides`,
            error: null,
          }));
        },
        error: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "error",
            progress: 0,
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
        progress: 0,
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

  // Idle state - show extract button
  if (slidesState.status === "idle") {
    return <IdleState onExtract={startExtraction} />;
  }

  // Loading state
  if (slidesState.status === "loading") {
    return <LoadingState />;
  }

  // Extracting state
  if (slidesState.status === "extracting") {
    return (
      <ExtractingState
        progress={slidesState.progress}
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
      slidesCount={slidesState.slides.length}
      slides={slidesState.slides}
      feedbackMap={feedbackMap}
      onSubmitFeedback={submitFeedback}
      onReExtract={() => {
        setSlidesState((prev) => ({
          ...prev,
          slides: [],
          progress: 0,
          message: "",
        }));
        startExtraction();
      }}
    />
  );
}

// ============================================================================
// State-specific Components
// ============================================================================

function IdleState({ onExtract }: { onExtract: () => void }) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>

          <div>
            <h3 className="text-lg font-semibold">Extract Slides</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Analyze the video to extract presentation slides
            </p>
          </div>

          <Button onClick={onExtract}>Extract Slides</Button>
        </div>
      </CardContent>
    </Card>
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
  progress,
  message,
  slides,
  feedbackMap,
  onSubmitFeedback,
}: {
  progress: number;
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
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground">{message}</p>

        {hasSlidesFound && (
          <div className="mt-6">
            <p className="text-sm font-medium mb-3">
              {slides.length} slides found so far
            </p>
            <SlideGrid
              slides={slides}
              allSlides={slides}
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
  slidesCount,
  slides,
  feedbackMap,
  onSubmitFeedback,
  onReExtract,
}: {
  slidesCount: number;
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
  onReExtract: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Slides ({slidesCount})
          </span>

          <Button variant="outline" size="sm" onClick={onReExtract}>
            Re-extract
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <SlideGrid
          slides={slides}
          allSlides={slides}
          feedbackMap={feedbackMap}
          onSubmitFeedback={onSubmitFeedback}
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Slide Grid with Virtual Scrolling
// ============================================================================

function SlideGrid({
  slides,
  allSlides,
  feedbackMap,
  onSubmitFeedback,
}: {
  slides: SlideData[];
  allSlides: SlideData[];
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
                  allSlides={allSlides}
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
