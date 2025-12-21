"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ImageIcon,
  Loader2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  ZoomIn,
} from "lucide-react";
import Image from "next/image";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  PickedSlide,
  SlideAnalysisState,
  SlideAnalysisStreamEvent,
  SlideData,
  SlideFeedbackData,
  SlideMarkdownData,
  SlideMarkdownFeedbackData,
} from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import { formatDuration } from "@/lib/time-utils";
import { ZoomDialog } from "./zoom-dialog";

// ============================================================================
// Types
// ============================================================================

interface SlideGridTabProps {
  videoId: string;
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
}

// nuqs view state parser
const viewParser = parseAsStringLiteral(["grid", "analysis"] as const);

// ============================================================================
// Main Component
// ============================================================================

export function SlideGridTab({
  videoId,
  slides,
  feedbackMap,
}: SlideGridTabProps) {
  const [view, setView] = useQueryState(
    "slideView",
    viewParser.withDefault("grid"),
  );
  const [slidesConfirmed, setSlidesConfirmed] = useState(false);
  const [analysisState, setAnalysisState] = useState<SlideAnalysisState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
  });
  const [markdownMap, setMarkdownMap] = useState<Map<string, string>>(
    new Map(),
  );
  const [feedbackDataMap, setFeedbackDataMap] = useState<
    Map<string, SlideMarkdownFeedbackData>
  >(new Map());

  // Compute picked slides from the slides and feedback
  const pickedSlides = useMemo(() => {
    const picked: PickedSlide[] = [];

    for (const slide of slides) {
      const feedback = feedbackMap.get(slide.slideNumber);
      const isFirstPicked = feedback?.isFirstFramePicked ?? true;
      const isLastPicked = feedback?.isLastFramePicked ?? false;

      if (isFirstPicked && slide.firstFrameImageUrl) {
        picked.push({
          slideNumber: slide.slideNumber,
          framePosition: "first",
          imageUrl: slide.firstFrameImageUrl,
          startTime: slide.startTime,
          endTime: slide.endTime,
        });
      }

      if (isLastPicked && slide.lastFrameImageUrl) {
        picked.push({
          slideNumber: slide.slideNumber,
          framePosition: "last",
          imageUrl: slide.lastFrameImageUrl,
          startTime: slide.startTime,
          endTime: slide.endTime,
        });
      }
    }

    return picked;
  }, [slides, feedbackMap]);

  // Load existing analysis data
  useEffect(() => {
    async function loadAnalysis() {
      try {
        const response = await fetch(`/api/video/${videoId}/slides/analysis`);
        if (!response.ok) return;

        const data = await response.json();

        if (data.status === "completed" && data.markdowns) {
          const newMap = new Map<string, string>();
          for (const md of data.markdowns as SlideMarkdownData[]) {
            const key = `${md.slideNumber}-${md.framePosition}`;
            newMap.set(key, md.markdown ?? "");
          }
          setMarkdownMap(newMap);
          setAnalysisState({
            status: "completed",
            progress: 100,
            message: "",
            error: null,
          });
        } else if (data.status === "streaming" || data.status === "pending") {
          setAnalysisState({
            status: "loading",
            progress: 0,
            message: "Analysis in progress...",
            error: null,
          });
        }
      } catch {
        // Ignore errors - analysis may not exist yet
      }
    }

    void loadAnalysis();
  }, [videoId]);

  // Load existing feedback
  useEffect(() => {
    async function loadFeedback() {
      try {
        const response = await fetch(
          `/api/video/${videoId}/slides/analysis/feedback`,
        );
        if (!response.ok) return;

        const data = await response.json();
        const newMap = new Map<string, SlideMarkdownFeedbackData>();
        for (const fb of data.feedback as SlideMarkdownFeedbackData[]) {
          const key = `${fb.slideNumber}-${fb.framePosition}`;
          newMap.set(key, fb);
        }
        setFeedbackDataMap(newMap);
      } catch {
        // Ignore errors
      }
    }

    void loadFeedback();
  }, [videoId]);

  const startAnalysis = useCallback(async () => {
    setAnalysisState({
      status: "streaming",
      progress: 0,
      message: "Starting slide analysis...",
      error: null,
    });
    setMarkdownMap(new Map());

    try {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides: pickedSlides.map((s) => ({
            slideNumber: s.slideNumber,
            framePosition: s.framePosition,
            imageUrl: s.imageUrl,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to start analysis" }));
        throw new Error(errorData.error);
      }

      await consumeSSE<SlideAnalysisStreamEvent>(response, {
        progress: (e) => {
          setAnalysisState((prev) => ({
            ...prev,
            status: "streaming",
            progress: e.progress ?? prev.progress,
            message: e.message ?? prev.message,
          }));
        },
        slide_markdown: (e) => {
          const key = `${e.slideNumber}-${e.framePosition}`;
          setMarkdownMap((prev) => {
            const next = new Map(prev);
            next.set(key, e.markdown);
            return next;
          });
        },
        complete: () => {
          setAnalysisState({
            status: "completed",
            progress: 100,
            message: "",
            error: null,
          });
          void setView("analysis");
        },
        error: (e) => {
          setAnalysisState({
            status: "error",
            progress: 0,
            message: "",
            error: e.message,
          });
        },
      });
    } catch (error) {
      setAnalysisState({
        status: "error",
        progress: 0,
        message: "",
        error:
          error instanceof Error ? error.message : "Failed to start analysis",
      });
    }
  }, [videoId, pickedSlides, setView]);

  const submitMarkdownFeedback = useCallback(
    async (feedback: SlideMarkdownFeedbackData) => {
      const key = `${feedback.slideNumber}-${feedback.framePosition}`;

      // Optimistic update
      setFeedbackDataMap((prev) => {
        const next = new Map(prev);
        next.set(key, feedback);
        return next;
      });

      try {
        const response = await fetch(
          `/api/video/${videoId}/slides/analysis/feedback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(feedback),
          },
        );

        if (!response.ok) {
          console.error("Failed to save markdown feedback");
        }
      } catch (error) {
        console.error("Failed to save markdown feedback:", error);
      }
    },
    [videoId],
  );

  const hasAnalysis =
    analysisState.status === "completed" && markdownMap.size > 0;

  if (view === "analysis" && hasAnalysis) {
    return (
      <AnalysisView
        pickedSlides={pickedSlides}
        markdownMap={markdownMap}
        feedbackMap={feedbackDataMap}
        onFeedbackSubmit={submitMarkdownFeedback}
        onBackToGrid={() => void setView("grid")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmationCard
        slidesConfirmed={slidesConfirmed}
        onSlidesConfirmedChange={setSlidesConfirmed}
        onStartAnalysis={startAnalysis}
        pickedCount={pickedSlides.length}
        isAnalyzing={analysisState.status === "streaming"}
        hasAnalysis={hasAnalysis}
        onViewAnalysis={() => void setView("analysis")}
        analysisProgress={analysisState.progress}
        analysisMessage={analysisState.message}
        analysisError={analysisState.error}
      />

      <PickedSlidesGrid slides={pickedSlides} />
    </div>
  );
}

// ============================================================================
// Confirmation Card
// ============================================================================

function ConfirmationCard({
  slidesConfirmed,
  onSlidesConfirmedChange,
  onStartAnalysis,
  pickedCount,
  isAnalyzing,
  hasAnalysis,
  onViewAnalysis,
  analysisProgress,
  analysisMessage,
  analysisError,
}: {
  slidesConfirmed: boolean;
  onSlidesConfirmedChange: (confirmed: boolean) => void;
  onStartAnalysis: () => void;
  pickedCount: number;
  isAnalyzing: boolean;
  hasAnalysis: boolean;
  onViewAnalysis: () => void;
  analysisProgress: number;
  analysisMessage: string;
  analysisError: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slide AI Analysis</CardTitle>
        <CardDescription>
          Before running an AI analysis of the curated slides, you can go to the{" "}
          <strong>Slide Curation</strong> tab to select exactly the slides that
          are useful and not redundant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {analysisError && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {analysisError}
          </div>
        )}

        {isAnalyzing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {analysisMessage || "Analyzing slides..."}
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={slidesConfirmed}
            onChange={(e) => onSlidesConfirmedChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
            disabled={isAnalyzing}
          />
          <span className="text-sm">
            Yes, these {pickedCount} slides look good to me
          </span>
        </label>

        <div className="flex gap-3">
          <Button
            onClick={onStartAnalysis}
            disabled={!slidesConfirmed || pickedCount === 0 || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Start AI Analysis"
            )}
          </Button>

          {hasAnalysis && (
            <Button variant="outline" onClick={onViewAnalysis}>
              View Analysis Results
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Picked Slides Grid
// ============================================================================

function PickedSlidesGrid({ slides }: { slides: PickedSlide[] }) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);

  const zoomImages = useMemo(
    () =>
      slides.map((s) => ({
        url: s.imageUrl,
        title: `Slide ${s.slideNumber} - ${s.framePosition === "first" ? "First" : "Last"} Frame`,
      })),
    [slides],
  );

  const handleZoom = (index: number) => {
    setZoomIndex(index);
    setZoomOpen(true);
  };

  if (slides.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No slides have been picked yet.</p>
            <p className="text-sm mt-1">
              Go to the Slide Curation tab to pick slides for analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Picked Slides ({slides.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {slides.map((slide, index) => (
              <PickedSlideCard
                key={`${slide.slideNumber}-${slide.framePosition}`}
                slide={slide}
                onZoom={() => handleZoom(index)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <ZoomDialog
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        imageUrl={slides[zoomIndex]?.imageUrl ?? null}
        title={zoomImages[zoomIndex]?.title ?? ""}
        allImages={zoomImages}
        currentIndex={zoomIndex}
      />
    </>
  );
}

function PickedSlideCard({
  slide,
  onZoom,
}: {
  slide: PickedSlide;
  onZoom: () => void;
}) {
  return (
    <div className="group relative rounded-lg border overflow-hidden bg-card">
      <button
        type="button"
        className="relative w-full cursor-zoom-in"
        onClick={onZoom}
      >
        {slide.imageUrl ? (
          <Image
            src={slide.imageUrl}
            alt={`Slide ${slide.slideNumber}`}
            width={384}
            height={216}
            className="w-full h-auto object-contain"
          />
        ) : (
          <div className="aspect-video flex items-center justify-center bg-muted">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      <div className="px-2 py-1.5 bg-muted/30 border-t">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">#{slide.slideNumber}</span>
          <span className="text-muted-foreground">
            {slide.framePosition === "first" ? "First" : "Last"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDuration(slide.startTime)} - {formatDuration(slide.endTime)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Analysis View
// ============================================================================

function AnalysisView({
  pickedSlides,
  markdownMap,
  feedbackMap,
  onFeedbackSubmit,
  onBackToGrid,
}: {
  pickedSlides: PickedSlide[];
  markdownMap: Map<string, string>;
  feedbackMap: Map<string, SlideMarkdownFeedbackData>;
  onFeedbackSubmit: (feedback: SlideMarkdownFeedbackData) => Promise<void>;
  onBackToGrid: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: pickedSlides.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400,
    overscan: 2,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Analysis Results</h3>
        <Button variant="outline" size="sm" onClick={onBackToGrid}>
          Back to Grid
        </Button>
      </div>

      <div
        ref={parentRef}
        className="h-[700px] overflow-auto"
        style={{ contain: "strict" }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const slide = pickedSlides[virtualItem.index];
            const key = `${slide.slideNumber}-${slide.framePosition}`;
            const markdown = markdownMap.get(key) ?? "";
            const feedback = feedbackMap.get(key);

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
                <div className="pb-4">
                  <SlideFrame
                    slide={slide}
                    index={virtualItem.index + 1}
                    totalSlides={pickedSlides.length}
                    markdown={markdown}
                    feedback={feedback}
                    onFeedbackSubmit={onFeedbackSubmit}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SlideFrame Component
// ============================================================================

function SlideFrame({
  slide,
  index,
  totalSlides,
  markdown,
  feedback,
  onFeedbackSubmit,
}: {
  slide: PickedSlide;
  index: number;
  totalSlides: number;
  markdown: string;
  feedback?: SlideMarkdownFeedbackData;
  onFeedbackSubmit: (feedback: SlideMarkdownFeedbackData) => Promise<void>;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <SlideDetail
          slideNumber={slide.slideNumber}
          framePosition={slide.framePosition}
          startTime={slide.startTime}
          endTime={slide.endTime}
          index={index}
          totalSlides={totalSlides}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slide Image */}
          <div className="group relative">
            <button
              type="button"
              className="relative w-full rounded-lg overflow-hidden cursor-zoom-in bg-muted"
              onClick={() => setZoomOpen(true)}
            >
              {slide.imageUrl ? (
                <Image
                  src={slide.imageUrl}
                  alt={`Slide ${slide.slideNumber}`}
                  width={384}
                  height={216}
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>

          {/* Markdown Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{markdown || "_No analysis available_"}</Streamdown>
          </div>
        </div>

        {/* Feedback Section */}
        <SlideToMdFeedback
          slideNumber={slide.slideNumber}
          framePosition={slide.framePosition}
          initialFeedback={feedback}
          onSubmit={onFeedbackSubmit}
        />
      </CardContent>

      <ZoomDialog
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        imageUrl={slide.imageUrl}
        title={`Slide ${slide.slideNumber} - ${slide.framePosition === "first" ? "First" : "Last"} Frame`}
      />
    </Card>
  );
}

// ============================================================================
// SlideDetail Component
// ============================================================================

function SlideDetail({
  slideNumber,
  framePosition,
  startTime,
  endTime,
  index,
  totalSlides,
}: {
  slideNumber: number;
  framePosition: "first" | "last";
  startTime: number;
  endTime: number;
  index: number;
  totalSlides: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">Slide #{slideNumber}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
          {framePosition === "first" ? "First Frame" : "Last Frame"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {formatDuration(startTime)} - {formatDuration(endTime)}
        </span>
        <span className="text-xs">
          {index} / {totalSlides}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SlideToMdFeedback Component
// ============================================================================

function SlideToMdFeedback({
  slideNumber,
  framePosition,
  initialFeedback,
  onSubmit,
}: {
  slideNumber: number;
  framePosition: "first" | "last";
  initialFeedback?: SlideMarkdownFeedbackData;
  onSubmit: (feedback: SlideMarkdownFeedbackData) => Promise<void>;
}) {
  const [feedbackType, setFeedbackType] = useState<
    "positive" | "negative" | null
  >(initialFeedback?.feedback ?? null);
  const [comment, setComment] = useState(initialFeedback?.comment ?? "");
  const [showComment, setShowComment] = useState(
    !!(initialFeedback?.comment && initialFeedback.comment.length > 0),
  );

  const handleFeedbackChange = (type: "positive" | "negative") => {
    const newType = feedbackType === type ? null : type;
    setFeedbackType(newType);

    void onSubmit({
      slideNumber,
      framePosition,
      feedback: newType,
      comment: comment || null,
    });
  };

  const handleCommentBlur = () => {
    void onSubmit({
      slideNumber,
      framePosition,
      feedback: feedbackType,
      comment: comment || null,
    });
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-md bg-muted/30 border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Was this analysis helpful?</span>
        <div className="flex items-center gap-2">
          <Button
            variant={feedbackType === "positive" ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => handleFeedbackChange("positive")}
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            variant={feedbackType === "negative" ? "destructive" : "outline"}
            size="sm"
            className="gap-1"
            onClick={() => handleFeedbackChange("negative")}
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
          <Button
            variant={showComment ? "secondary" : "ghost"}
            size="sm"
            className="gap-1"
            onClick={() => setShowComment(!showComment)}
          >
            <MessageSquare className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {showComment && (
        <Textarea
          placeholder="Add a comment about this analysis..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={handleCommentBlur}
          className="min-h-[60px] text-sm"
        />
      )}
    </div>
  );
}
