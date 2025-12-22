"use client";

import { ImageIcon, Loader2, ZoomIn } from "lucide-react";
import Image from "next/image";
import { createParser, useQueryStates } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const parseAsPresence = createParser<boolean>({
  parse: (value) =>
    value === "" || value.toLowerCase() === "true" ? true : null,
  serialize: () => "",
});

const tabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slidesGrid: parseAsPresence,
};

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  PickedSlide,
  SlideAnalysisState,
  SlideData,
  SlideFeedbackData,
} from "@/lib/slides-types";
import { formatDuration } from "@/lib/time-utils";
import { ZoomDialog } from "./zoom-dialog";

// ============================================================================
// Types
// ============================================================================

interface SlideGridTabProps {
  slides: SlideData[];
  feedbackMap: Map<number, SlideFeedbackData>;
  onAnalyzeSelectedSlides: () => Promise<void>;
  analysisState: SlideAnalysisState;
  hasAnalysisResults: boolean;
  pickedCount: number;
}

// ============================================================================
// Main Component
// ============================================================================

export function SlideGridTab({
  slides,
  feedbackMap,
  onAnalyzeSelectedSlides,
  analysisState,
  hasAnalysisResults,
  pickedCount,
}: SlideGridTabProps) {
  const [slidesConfirmed, setSlidesConfirmed] = useState(false);

  // Compute picked slides from the slides and feedback
  const pickedSlides = useMemo(() => {
    const picked: PickedSlide[] = [];

    for (const slide of slides) {
      const feedback = feedbackMap.get(slide.slideNumber);
      const isFirstPicked = feedback?.isFirstFramePicked ?? false;
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

  return (
    <div className="space-y-6">
      <ConfirmationCard
        slidesConfirmed={slidesConfirmed}
        onSlidesConfirmedChange={setSlidesConfirmed}
        pickedCount={pickedCount}
        onAnalyzeSelectedSlides={onAnalyzeSelectedSlides}
        analysisState={analysisState}
        hasAnalysisResults={hasAnalysisResults}
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
  pickedCount,
  onAnalyzeSelectedSlides,
  analysisState,
  hasAnalysisResults,
}: {
  slidesConfirmed: boolean;
  onSlidesConfirmedChange: (confirmed: boolean) => void;
  pickedCount: number;
  onAnalyzeSelectedSlides: () => Promise<void>;
  analysisState: SlideAnalysisState;
  hasAnalysisResults: boolean;
}) {
  const [, setQueryState] = useQueryStates(tabQueryConfig);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Slide Review</CardTitle>
        <CardDescription>
          Review the curated slides below. You can go to the{" "}
          <button
            type="button"
            onClick={() =>
              setQueryState({ slides: true, slidesGrid: null, analyze: null })
            }
            className="text-primary underline underline-offset-4 cursor-pointer"
          >
            Slide Curation
          </button>{" "}
          tab to select exactly the slides that are useful and not redundant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={slidesConfirmed}
            onChange={(e) => onSlidesConfirmedChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
          />
          <span className="text-sm">
            Yes, these {pickedCount} slides look good to me
          </span>
        </label>

        <Button
          variant="default"
          size="sm"
          onClick={onAnalyzeSelectedSlides}
          disabled={!slidesConfirmed || analysisState.status === "streaming"}
          className="w-full"
        >
          {analysisState.status === "streaming" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : hasAnalysisResults ? (
            "Re-analyze Selected"
          ) : (
            "Analyze Selected Slides"
          )}
        </Button>
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

  // Reset zoomIndex when slides array changes to prevent out-of-bounds access
  useEffect(() => {
    // If the current zoomIndex is out of bounds, reset it
    if (zoomIndex >= slides.length && slides.length > 0) {
      setZoomIndex(slides.length - 1);
    } else if (slides.length === 0) {
      setZoomIndex(0);
    }
  }, [slides.length, zoomIndex]);

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
            Picked Frames ({slides.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
