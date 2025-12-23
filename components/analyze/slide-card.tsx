"use client";

import { ImageIcon, ZoomIn } from "lucide-react";
import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SlideData, SlideFeedbackData } from "@/lib/slides-types";
import { formatDuration } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
import { ZoomDialog } from "./zoom-dialog";

// ============================================================================
// Frame Card Component
// ============================================================================

interface FrameCardProps {
  label: "First" | "Last";
  imageUrl: string | null;
  onZoom: () => void;
  isPicked: boolean;
  onPickedChange: (picked: boolean) => void;
}

function FrameCard({
  label,
  imageUrl,
  onZoom,
  isPicked,
  onPickedChange,
}: FrameCardProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Frame header with prominent checkbox */}
      <label
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
          isPicked
            ? "bg-primary/10 border-primary shadow-sm"
            : "bg-muted/30 border-muted hover:border-primary/50 hover:bg-primary/5",
        )}
      >
        <input
          type="checkbox"
          checked={isPicked}
          onChange={(e) => onPickedChange(e.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
        />
        <span className="text-base font-semibold">Pick {label} Frame</span>
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
              src={imageUrl}
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
      </div>
    </div>
  );
}

// ============================================================================
// Slide Card Component
// ============================================================================

interface SlideCardProps {
  slide: SlideData;
  initialFeedback?: SlideFeedbackData;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
  showOnlyPickedFrames?: boolean;
}

function SlideCardComponent({
  slide,
  initialFeedback,
  onSubmitFeedback,
  showOnlyPickedFrames = false,
}: SlideCardProps) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomFrame, setZoomFrame] = useState<"first" | "last">("first");

  const [localChanges, setLocalChanges] = useState<Partial<SlideFeedbackData>>(
    {},
  );

  const feedback = useMemo(
    (): SlideFeedbackData => ({
      slideNumber: slide.slideNumber,
      firstFrameHasUsefulContent: null,
      lastFrameHasUsefulContent: null,
      framesSameness: null,
      isFirstFramePicked: false,
      isLastFramePicked: false,
      ...initialFeedback,
      ...localChanges,
    }),
    [slide.slideNumber, initialFeedback, localChanges],
  );

  const updateField = useCallback(
    <K extends keyof SlideFeedbackData>(
      field: K,
      value: SlideFeedbackData[K],
    ) => setLocalChanges((prev) => ({ ...prev, [field]: value })),
    [],
  );

  useEffect(() => {
    if (Object.keys(localChanges).length === 0) return;

    const timeout = setTimeout(() => {
      onSubmitFeedback(feedback);
    }, 500);

    return () => clearTimeout(timeout);
  }, [feedback, localChanges, onSubmitFeedback]);

  const handleZoom = useCallback((frame: "first" | "last") => {
    setZoomFrame(frame);
    setZoomOpen(true);
  }, []);

  // Build images array for zoom navigation
  const zoomImages = [
    {
      url: slide.firstFrameImageUrl,
      title: `Slide ${slide.slideNumber} - First Frame`,
    },
    {
      url: slide.lastFrameImageUrl,
      title: `Slide ${slide.slideNumber} - Last Frame`,
    },
  ];

  // Determine which frames to show when in "show only picked" mode
  const showFirstFrame = !showOnlyPickedFrames || feedback.isFirstFramePicked;
  const showLastFrame = !showOnlyPickedFrames || feedback.isLastFramePicked;
  const showBothFrames = showFirstFrame && showLastFrame;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-3">
          <span className="font-semibold">Slide #{slide.slideNumber}</span>
          <span className="text-sm text-muted-foreground">
            {formatDuration(slide.startTime)} - {formatDuration(slide.endTime)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* First and Last frames - side by side or single column depending on visibility */}
        <div
          className={cn(
            "grid gap-4",
            showBothFrames
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 max-w-md",
          )}
        >
          {showFirstFrame && (
            <FrameCard
              label="First"
              imageUrl={slide.firstFrameImageUrl}
              onZoom={() => handleZoom("first")}
              isPicked={feedback.isFirstFramePicked}
              onPickedChange={(picked) =>
                updateField("isFirstFramePicked", picked)
              }
            />
          )}
          {showLastFrame && (
            <FrameCard
              label="Last"
              imageUrl={slide.lastFrameImageUrl}
              onZoom={() => handleZoom("last")}
              isPicked={feedback.isLastFramePicked}
              onPickedChange={(picked) =>
                updateField("isLastFramePicked", picked)
              }
            />
          )}
        </div>

        {/* Slide-level annotations - only show when not in "show only picked" mode */}
        {!showOnlyPickedFrames && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 text-sm">
              <span className="text-muted-foreground">
                Report first and last frame having different useful content?
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant={
                    feedback.framesSameness === "different"
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  onClick={() =>
                    updateField(
                      "framesSameness",
                      feedback.framesSameness === "different"
                        ? null
                        : "different",
                    )
                  }
                >
                  Report
                </Button>
              </div>
            </div>
          </div>
        )}
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
        title={`Slide ${slide.slideNumber} - ${zoomFrame === "first" ? "First" : "Last"} Frame`}
        allImages={zoomImages}
        currentIndex={zoomFrame === "first" ? 0 : 1}
      />
    </div>
  );
}

function areFeedbackEqual(
  prev?: SlideFeedbackData,
  next?: SlideFeedbackData,
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;

  return (
    prev.slideNumber === next.slideNumber &&
    prev.isFirstFramePicked === next.isFirstFramePicked &&
    prev.isLastFramePicked === next.isLastFramePicked &&
    prev.framesSameness === next.framesSameness &&
    prev.firstFrameHasUsefulContent === next.firstFrameHasUsefulContent &&
    prev.lastFrameHasUsefulContent === next.lastFrameHasUsefulContent
  );
}

function areSlideCardPropsEqual(
  prev: SlideCardProps,
  next: SlideCardProps,
): boolean {
  // Check primitive props
  if (prev.showOnlyPickedFrames !== next.showOnlyPickedFrames) return false;
  if (prev.onSubmitFeedback !== next.onSubmitFeedback) return false;

  // Check slide prop (shallow compare usually sufficient for SlideData from DB)
  if (prev.slide.slideNumber !== next.slide.slideNumber) return false;
  if (prev.slide.firstFrameImageUrl !== next.slide.firstFrameImageUrl)
    return false;

  // Check initialFeedback
  return areFeedbackEqual(prev.initialFeedback, next.initialFeedback);
}

export const SlideCard = memo(SlideCardComponent, areSlideCardPropsEqual);
