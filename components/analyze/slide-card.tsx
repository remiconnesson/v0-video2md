"use client";

import {
  Check,
  Copy,
  ImageIcon,
  ThumbsDown,
  ThumbsUp,
  X,
  ZoomIn,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SlideData, SlideFeedbackData } from "@/lib/slides-types";
import { formatTime } from "@/lib/time-utils";
import { cn } from "@/lib/utils";
import { ZoomDialog } from "./zoom-dialog";

// ============================================================================
// Types
// ============================================================================

interface FrameValidation {
  isDuplicateValidated?: boolean | null;
}

type SamenessFeedback = "same" | "different" | null;

// ============================================================================
// Frame Card Component
// ============================================================================

interface FrameCardProps {
  label: "First" | "Last";
  imageUrl: string | null;
  isDuplicate: boolean;
  duplicateOfSegmentId: number | null;
  duplicateOfFramePosition: string | null;
  skipReason: string | null;
  allSlides: SlideData[];
  onZoom: () => void;
  validation: FrameValidation;
  onValidate: (field: "isDuplicate", value: boolean | null) => void;
  isPicked: boolean;
  onPickedChange: (picked: boolean) => void;
}

function FrameCard({
  label,
  imageUrl,
  isDuplicate,
  duplicateOfSegmentId,
  duplicateOfFramePosition,
  skipReason,
  allSlides,
  onZoom,
  validation,
  onValidate,
  isPicked,
  onPickedChange,
}: FrameCardProps) {
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
        {/* Duplicate annotation with validation */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                isDuplicate ? "text-orange-600" : "text-muted-foreground",
              )}
            >
              {isDuplicate
                ? `Duplicate of #${(duplicateOfSegmentId ?? 0) + 1}-${duplicateOfFramePosition || "?"}`
                : "Unique"}
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

  const [firstValidation, setFirstValidation] = useState<FrameValidation>({
    isDuplicateValidated:
      initialFeedback?.firstFrameIsDuplicateValidated ?? null,
  });
  const [lastValidation, setLastValidation] = useState<FrameValidation>({
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
        isDuplicateValidated:
          initialFeedback.firstFrameIsDuplicateValidated ?? null,
      });
      setLastValidation({
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
      firstFrameIsDuplicateValidated:
        firstValidation.isDuplicateValidated ?? null,
      lastFrameIsDuplicateValidated:
        lastValidation.isDuplicateValidated ?? null,
      framesSameness: samenessFeedback,
      isFirstFramePicked,
      isLastFramePicked,
    };

    // Only submit if at least one field has a value
    const hasAnyValue =
      feedback.firstFrameIsDuplicateValidated !== null ||
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
    (_field: "isDuplicate", value: boolean | null) => {
      setFirstValidation((prev) => ({
        ...prev,
        isDuplicateValidated: value,
      }));
    },
    [],
  );

  const handleLastValidate = useCallback(
    (_field: "isDuplicate", value: boolean | null) => {
      setLastValidation((prev) => ({
        ...prev,
        isDuplicateValidated: value,
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
            isDuplicate={slide.firstFrameIsDuplicate}
            duplicateOfSegmentId={slide.firstFrameDuplicateOfSegmentId}
            duplicateOfFramePosition={slide.firstFrameDuplicateOfFramePosition}
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
            isDuplicate={slide.lastFrameIsDuplicate}
            duplicateOfSegmentId={slide.lastFrameDuplicateOfSegmentId}
            duplicateOfFramePosition={slide.lastFrameDuplicateOfFramePosition}
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
