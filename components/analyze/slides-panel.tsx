"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ImageIcon,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  X,
  ZoomIn,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type {
  SlideData,
  SlideFeedbackData,
  SlideStreamEvent,
  SlidesState,
} from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import { formatTime } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

interface SlidesPanelProps {
  videoId: string;
  slidesState: SlidesState;
  onSlidesStateChange: (
    state: SlidesState | ((prev: SlidesState) => SlidesState),
  ) => void;
}

export function SlidesPanel({
  videoId,
  slidesState,
  onSlidesStateChange,
}: SlidesPanelProps) {
  const [feedbackMap, setFeedbackMap] = useState<
    Map<number, SlideFeedbackData>
  >(new Map());

  const loadFeedback = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${videoId}/slides/feedback`);
      if (!response.ok) return;

      const data = await response.json();
      const newMap = new Map<number, SlideFeedbackData>();

      data.feedback.forEach((fb: SlideFeedbackData) => {
        newMap.set(fb.slideIndex, fb);
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
          next.set(feedback.slideIndex, feedback);
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
    onSlidesStateChange((prev) => ({
      ...prev,
      status: "extracting",
      progress: 0,
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
          onSlidesStateChange((prev) => ({
            ...prev,
            status: "extracting",
            progress: e.progress ?? prev.progress,
            message: e.message ?? prev.message,
          }));
        },
        slide: (e) => {
          onSlidesStateChange((prev) => ({
            ...prev,
            slides: [...prev.slides, e.slide],
          }));
        },
        complete: (e) => {
          onSlidesStateChange((prev) => ({
            ...prev,
            status: "completed",
            progress: 100,
            message: `Extracted ${e.totalSlides} slides`,
            error: null,
          }));
        },
        error: (e) => {
          onSlidesStateChange((prev) => ({
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

      onSlidesStateChange((prev) => ({
        ...prev,
        status: "error",
        progress: 0,
        message: "",
        error: errorMessage,
      }));
    }
  }, [videoId, onSlidesStateChange]);

  // Load feedback on mount
  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Idle state - show extract button
  if (slidesState.status === "idle") {
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
            <p className="text-sm text-muted-foreground">
              Slides will be extracted automatically when processing starts.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (slidesState.status === "loading") {
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

  // Extracting state
  if (slidesState.status === "extracting") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Extracting Slides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={slidesState.progress} className="h-2" />
          <p className="text-sm text-muted-foreground">{slidesState.message}</p>

          {slidesState.slides.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-3">
                {slidesState.slides.length} slides found so far
              </p>
              <SlideGrid
                slides={slidesState.slides}
                allSlides={slidesState.slides}
                feedbackMap={feedbackMap}
                onSubmitFeedback={submitFeedback}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (slidesState.status === "error") {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <p className="text-destructive">{slidesState.error}</p>
            <Button
              variant="outline"
              onClick={() => {
                startExtraction();
              }}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state - show slides
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Slides ({slidesState.slides.length})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Clear slides and trigger re-extraction
              onSlidesStateChange((prev) => ({
                ...prev,
                slides: [],
                progress: 0,
                message: "",
              }));
              startExtraction();
            }}
          >
            Re-extract
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SlideGrid
          slides={slidesState.slides}
          allSlides={slidesState.slides}
          feedbackMap={feedbackMap}
          onSubmitFeedback={submitFeedback}
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
                  initialFeedback={feedbackMap.get(slide.slideIndex)}
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

// ============================================================================
// Zoom Dialog
// ============================================================================

function ZoomDialog({
  open,
  onOpenChange,
  imageUrl,
  title,
  allImages,
  currentIndex,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title: string;
  allImages?: { url: string | null; title: string }[];
  currentIndex?: number;
}) {
  const [viewingIndex, setViewingIndex] = useState(currentIndex ?? 0);

  useEffect(() => {
    if (currentIndex !== undefined) {
      setViewingIndex(currentIndex);
    }
  }, [currentIndex]);

  const hasPrev = allImages && viewingIndex > 0;
  const hasNext = allImages && viewingIndex < allImages.length - 1;

  const currentImage = allImages
    ? allImages[viewingIndex]
    : { url: imageUrl, title };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">{currentImage.title}</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center bg-black/95">
          {/* Navigation buttons */}
          {hasPrev && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
              onClick={() => setViewingIndex((i) => i - 1)}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
              onClick={() => setViewingIndex((i) => i + 1)}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Image */}
          {currentImage.url ? (
            <div className="relative w-full h-[85vh]">
              <Image
                src={currentImage.url || "/placeholder.svg"}
                alt={currentImage.title}
                fill
                className="object-contain"
                sizes="90vw"
                priority
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[50vh]">
              <ImageIcon className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white text-center">{currentImage.title}</p>
            {allImages && (
              <p className="text-white/60 text-center text-sm mt-1">
                {viewingIndex + 1} / {allImages.length}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Frame Card (individual frame with side annotation)
// ============================================================================

interface FrameValidation {
  hasTextValidated?: boolean | null; // null = not validated, true = correct, false = incorrect
  isDuplicateValidated?: boolean | null;
}

function FrameCard({
  label,
  imageUrl,
  hasText,
  textConfidence,
  isDuplicate,
  duplicateOfSegmentId,
  skipReason,
  allSlides,
  onZoom,
  validation,
  onValidate,
  isPicked,
  onPickedChange,
}: {
  label: "First" | "Last";
  imageUrl: string | null;
  hasText: boolean;
  textConfidence: number;
  isDuplicate: boolean;
  duplicateOfSegmentId: number | null;
  skipReason: string | null;
  allSlides: SlideData[];
  onZoom: () => void;
  validation: FrameValidation;
  onValidate: (field: "hasText" | "isDuplicate", value: boolean | null) => void;
  isPicked: boolean;
  onPickedChange: (picked: boolean) => void;
}) {
  // Find duplicate slide if exists
  const duplicateSlide =
    isDuplicate && duplicateOfSegmentId !== null
      ? allSlides.find((s) => s.slideIndex === duplicateOfSegmentId)
      : null;

  const duplicateImageUrl = duplicateSlide
    ? label === "First"
      ? duplicateSlide.firstFrameImageUrl
      : duplicateSlide.lastFrameImageUrl
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Frame header with checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isPicked}
          onChange={(e) => onPickedChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
        />
        <span className="text-sm font-medium">{label} Frame</span>
      </label>

      {/* Image container - preserves aspect ratio */}
      <div className="relative w-full group">
        <button
          type="button"
          className="relative bg-muted rounded-lg overflow-hidden cursor-zoom-in w-full"
          onClick={onZoom}
        >
          {imageUrl ? (
            <Image
              src={imageUrl || "/placeholder.svg"}
              alt={`${label} frame`}
              width={384}
              height={216}
              className="w-full h-auto object-contain"
            />
          ) : (
            <div className="aspect-video flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          {/* Zoom hint overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Frame label */}
          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
            {label}
          </div>
        </button>

        {/* Mini duplicate preview */}
        {isDuplicate && duplicateImageUrl && (
          <div className="mt-2 flex items-center gap-2">
            <Copy className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="relative w-16 rounded overflow-hidden border">
              <Image
                src={duplicateImageUrl || "/placeholder.svg"}
                alt={`Duplicate of slide ${duplicateOfSegmentId}`}
                width={64}
                height={36}
                className="w-full h-auto object-contain"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              #{(duplicateOfSegmentId ?? 0) + 1}
            </span>
          </div>
        )}
      </div>

      {/* Annotation panel below image */}
      <div className="w-full space-y-3 text-sm">
        {/* Has Text annotation with validation */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                hasText ? "text-green-600" : "text-muted-foreground",
              )}
            >
              Has Text: {hasText ? `Yes (${textConfidence}%)` : "No"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={
                validation.hasTextValidated === true ? "default" : "ghost"
              }
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                onValidate(
                  "hasText",
                  validation.hasTextValidated === true ? null : true,
                )
              }
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant={
                validation.hasTextValidated === false ? "destructive" : "ghost"
              }
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                onValidate(
                  "hasText",
                  validation.hasTextValidated === false ? null : false,
                )
              }
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Duplicate annotation with validation */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                isDuplicate ? "text-orange-600" : "text-muted-foreground",
              )}
            >
              Duplicate:{" "}
              {isDuplicate
                ? `Yes (of #${(duplicateOfSegmentId ?? 0) + 1})`
                : "No"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={
                validation.isDuplicateValidated === true ? "default" : "ghost"
              }
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                onValidate(
                  "isDuplicate",
                  validation.isDuplicateValidated === true ? null : true,
                )
              }
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant={
                validation.isDuplicateValidated === false
                  ? "destructive"
                  : "ghost"
              }
              size="icon"
              className="h-6 w-6"
              onClick={() =>
                onValidate(
                  "isDuplicate",
                  validation.isDuplicateValidated === false ? null : false,
                )
              }
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Skip reason if present */}
        {skipReason && (
          <div className="p-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs">
            Skip: {skipReason}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Slide Card
// ============================================================================

type SamenessFeedback = "same" | "different" | null;

function SlideCard({
  slide,
  allSlides,
  initialFeedback,
  onSubmitFeedback,
}: {
  slide: SlideData;
  allSlides: SlideData[];
  initialFeedback?: SlideFeedbackData;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomFrame, setZoomFrame] = useState<"first" | "last">("first");

  const [firstValidation, setFirstValidation] = useState<FrameValidation>({
    hasTextValidated: initialFeedback?.firstFrameHasTextValidated ?? null,
    isDuplicateValidated:
      initialFeedback?.firstFrameIsDuplicateValidated ?? null,
  });
  const [lastValidation, setLastValidation] = useState<FrameValidation>({
    hasTextValidated: initialFeedback?.lastFrameHasTextValidated ?? null,
    isDuplicateValidated:
      initialFeedback?.lastFrameIsDuplicateValidated ?? null,
  });
  const [samenessFeedback, setSamenessFeedback] = useState<SamenessFeedback>(
    initialFeedback?.framesSameness ?? null,
  );
  const [isFirstFramePicked, setIsFirstFramePicked] = useState<boolean>(
    initialFeedback?.isFirstFramePicked ?? true,
  );
  const [isLastFramePicked, setIsLastFramePicked] = useState<boolean>(
    initialFeedback?.isLastFramePicked ?? true,
  );

  // Track when we're syncing from external feedback to prevent submission loop
  const isSyncingFromFeedback = useRef(false);

  // Sync state when initialFeedback prop changes
  useEffect(() => {
    if (initialFeedback) {
      isSyncingFromFeedback.current = true;
      setFirstValidation({
        hasTextValidated: initialFeedback.firstFrameHasTextValidated ?? null,
        isDuplicateValidated:
          initialFeedback.firstFrameIsDuplicateValidated ?? null,
      });
      setLastValidation({
        hasTextValidated: initialFeedback.lastFrameHasTextValidated ?? null,
        isDuplicateValidated:
          initialFeedback.lastFrameIsDuplicateValidated ?? null,
      });
      setSamenessFeedback(initialFeedback.framesSameness ?? null);
      setIsFirstFramePicked(initialFeedback.isFirstFramePicked ?? true);
      setIsLastFramePicked(initialFeedback.isLastFramePicked ?? false);
    }
  }, [initialFeedback]);

  // Submit feedback when it changes
  useEffect(() => {
    // Skip submission if we're syncing from external feedback
    if (isSyncingFromFeedback.current) {
      isSyncingFromFeedback.current = false;
      return;
    }

    const feedback: SlideFeedbackData = {
      slideIndex: slide.slideIndex,
      firstFrameHasTextValidated: firstValidation.hasTextValidated ?? null,
      firstFrameIsDuplicateValidated:
        firstValidation.isDuplicateValidated ?? null,
      lastFrameHasTextValidated: lastValidation.hasTextValidated ?? null,
      lastFrameIsDuplicateValidated:
        lastValidation.isDuplicateValidated ?? null,
      framesSameness: samenessFeedback,
      isFirstFramePicked,
      isLastFramePicked,
    };

    // Only submit if at least one field has a value
    const hasAnyValue =
      feedback.firstFrameHasTextValidated !== null ||
      feedback.firstFrameIsDuplicateValidated !== null ||
      feedback.lastFrameHasTextValidated !== null ||
      feedback.lastFrameIsDuplicateValidated !== null ||
      feedback.framesSameness !== null ||
      feedback.isFirstFramePicked !== null ||
      feedback.isLastFramePicked !== null;

    if (hasAnyValue) {
      onSubmitFeedback(feedback);
    }
  }, [
    firstValidation,
    lastValidation,
    samenessFeedback,
    isFirstFramePicked,
    isLastFramePicked,
    slide.slideIndex,
    onSubmitFeedback,
  ]);

  const handleZoom = useCallback((frame: "first" | "last") => {
    setZoomFrame(frame);
    setZoomOpen(true);
  }, []);

  const handleFirstValidate = useCallback(
    (field: "hasText" | "isDuplicate", value: boolean | null) => {
      setFirstValidation((prev) => ({
        ...prev,
        [field === "hasText" ? "hasTextValidated" : "isDuplicateValidated"]:
          value,
      }));
    },
    [],
  );

  const handleLastValidate = useCallback(
    (field: "hasText" | "isDuplicate", value: boolean | null) => {
      setLastValidation((prev) => ({
        ...prev,
        [field === "hasText" ? "hasTextValidated" : "isDuplicateValidated"]:
          value,
      }));
    },
    [],
  );

  // Build images array for zoom navigation
  const zoomImages = [
    {
      url: slide.firstFrameImageUrl,
      title: `Slide ${slide.slideIndex + 1} - First Frame`,
    },
    {
      url: slide.lastFrameImageUrl,
      title: `Slide ${slide.slideIndex + 1} - Last Frame`,
    },
  ];

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Slide #{slide.slideIndex + 1}</span>
          <span className="text-sm text-muted-foreground">
            {formatTime(slide.startTime)} - {formatTime(slide.endTime)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* First and Last frames side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FrameCard
            label="First"
            imageUrl={slide.firstFrameImageUrl}
            hasText={slide.firstFrameHasText}
            textConfidence={slide.firstFrameTextConfidence}
            isDuplicate={slide.firstFrameIsDuplicate}
            duplicateOfSegmentId={slide.firstFrameDuplicateOfSegmentId}
            skipReason={slide.firstFrameSkipReason}
            allSlides={allSlides}
            onZoom={() => handleZoom("first")}
            validation={firstValidation}
            onValidate={handleFirstValidate}
            isPicked={isFirstFramePicked}
            onPickedChange={setIsFirstFramePicked}
          />
          <FrameCard
            label="Last"
            imageUrl={slide.lastFrameImageUrl}
            hasText={slide.lastFrameHasText}
            textConfidence={slide.lastFrameTextConfidence}
            isDuplicate={slide.lastFrameIsDuplicate}
            duplicateOfSegmentId={slide.lastFrameDuplicateOfSegmentId}
            skipReason={slide.lastFrameSkipReason}
            allSlides={allSlides}
            onZoom={() => handleZoom("last")}
            validation={lastValidation}
            onValidate={handleLastValidate}
            isPicked={isLastFramePicked}
            onPickedChange={setIsLastFramePicked}
          />
        </div>

        {/* Sameness feedback section */}
        <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border">
          <span className="text-sm font-medium">
            Are First and Last frames the same content?
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant={samenessFeedback === "same" ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() =>
                setSamenessFeedback(samenessFeedback === "same" ? null : "same")
              }
            >
              <ThumbsUp className="h-3 w-3" />
              Same
            </Button>
            <Button
              variant={
                samenessFeedback === "different" ? "destructive" : "outline"
              }
              size="sm"
              className="gap-1"
              onClick={() =>
                setSamenessFeedback(
                  samenessFeedback === "different" ? null : "different",
                )
              }
            >
              <ThumbsDown className="h-3 w-3" />
              Different
            </Button>
          </div>
        </div>
      </div>

      {/* Zoom Dialog */}
      <ZoomDialog
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        imageUrl={
          zoomFrame === "first"
            ? slide.firstFrameImageUrl
            : slide.lastFrameImageUrl
        }
        title={`Slide ${slide.slideIndex + 1} - ${zoomFrame === "first" ? "First" : "Last"} Frame`}
        allImages={zoomImages}
        currentIndex={zoomFrame === "first" ? 0 : 1}
      />
    </div>
  );
}
