"use client";

import { Copy, ImageIcon, ThumbsDown, ThumbsUp, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SlideData, SlideFeedbackData } from "@/lib/slides-types";
import { formatDuration } from "@/lib/time-utils";
import { ZoomDialog } from "./zoom-dialog";

// ============================================================================
// Frame Card Component
// ============================================================================

interface FrameCardProps {
  label: "First" | "Last";
  imageUrl: string | null;
  isDuplicate: boolean;
  duplicateOfSlideNumber: number | null;
  duplicateOfFramePosition: string | null;
  allSlides: SlideData[];
  onZoom: () => void;
  isPicked: boolean;
  onPickedChange: (picked: boolean) => void;
  hasUsefulContent: boolean | null;
  onUsefulContentChange: (value: boolean | null) => void;
}

function FrameCard({
  label,
  imageUrl,
  isDuplicate,
  duplicateOfSlideNumber,
  duplicateOfFramePosition,
  allSlides,
  onZoom,
  isPicked,
  onPickedChange,
  hasUsefulContent,
  onUsefulContentChange,
}: FrameCardProps) {
  // Find duplicate slide if exists
  const duplicateSlide =
    isDuplicate && duplicateOfSlideNumber !== null
      ? allSlides.find((s) => s.slideNumber === duplicateOfSlideNumber)
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
                alt={`Duplicate of slide ${duplicateOfSlideNumber}`}
                width={64}
                height={36}
                className="w-full h-auto object-contain"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              #{duplicateOfSlideNumber}
              {duplicateOfFramePosition ? `-${duplicateOfFramePosition}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 p-3">
        <span className="text-sm font-medium">
          Does this frame have useful content?
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant={hasUsefulContent === true ? "default" : "outline"}
            size="sm"
            onClick={() =>
              onUsefulContentChange(hasUsefulContent === true ? null : true)
            }
          >
            <ThumbsUp className="mr-1 h-3 w-3" />
            Yes
          </Button>
          <Button
            variant={hasUsefulContent === false ? "destructive" : "outline"}
            size="sm"
            onClick={() =>
              onUsefulContentChange(hasUsefulContent === false ? null : false)
            }
          >
            <ThumbsDown className="mr-1 h-3 w-3" />
            No
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Slide Card Component
// ============================================================================

interface SlideCardProps {
  slide: SlideData;
  allSlides: SlideData[];
  initialFeedback?: SlideFeedbackData;
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>;
}

export function SlideCard({
  slide,
  allSlides,
  initialFeedback,
  onSubmitFeedback,
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
      isFirstFramePicked: true,
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
        {/* First and Last frames side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FrameCard
            label="First"
            imageUrl={slide.firstFrameImageUrl}
            isDuplicate={slide.firstFrameIsDuplicate}
            duplicateOfSlideNumber={slide.firstFrameDuplicateOfSlideNumber}
            duplicateOfFramePosition={slide.firstFrameDuplicateOfFramePosition}
            allSlides={allSlides}
            onZoom={() => handleZoom("first")}
            isPicked={feedback.isFirstFramePicked}
            onPickedChange={(picked) =>
              updateField("isFirstFramePicked", picked)
            }
            hasUsefulContent={feedback.firstFrameHasUsefulContent}
            onUsefulContentChange={(value) =>
              updateField("firstFrameHasUsefulContent", value)
            }
          />
          <FrameCard
            label="Last"
            imageUrl={slide.lastFrameImageUrl}
            isDuplicate={slide.lastFrameIsDuplicate}
            duplicateOfSlideNumber={slide.lastFrameDuplicateOfSlideNumber}
            duplicateOfFramePosition={slide.lastFrameDuplicateOfFramePosition}
            allSlides={allSlides}
            onZoom={() => handleZoom("last")}
            isPicked={feedback.isLastFramePicked}
            onPickedChange={(picked) =>
              updateField("isLastFramePicked", picked)
            }
            hasUsefulContent={feedback.lastFrameHasUsefulContent}
            onUsefulContentChange={(value) =>
              updateField("lastFrameHasUsefulContent", value)
            }
          />
        </div>

        {/* Slide-level annotations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/30 border">
            <span className="text-sm font-medium">
              Do first and last frames show similar content?
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant={
                  feedback.framesSameness === "same" ? "default" : "outline"
                }
                size="sm"
                onClick={() =>
                  updateField(
                    "framesSameness",
                    feedback.framesSameness === "same" ? null : "same",
                  )
                }
              >
                Same
              </Button>
              <Button
                variant={
                  feedback.framesSameness === "different"
                    ? "default"
                    : "outline"
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
                Different
              </Button>
            </div>
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
        title={`Slide ${slide.slideNumber} - ${zoomFrame === "first" ? "First" : "Last"} Frame`}
        allImages={zoomImages}
        currentIndex={zoomFrame === "first" ? 0 : 1}
      />
    </div>
  );
}
