"use client";

import { ImageIcon, Loader2, Play } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSlideExtraction } from "@/hooks/use-slides-extraction";
import type { SlideData } from "@/lib/slides-types";
import { formatTime } from "@/lib/time-utils";

interface SlidesPanelProps {
  videoId: string;
}

export function SlidesPanel({ videoId }: SlidesPanelProps) {
  const { state, slides, startExtraction, loadExistingSlides } =
    useSlideExtraction(videoId);

  // Load existing slides on mount
  useEffect(() => {
    loadExistingSlides();
  }, [loadExistingSlides]);

  // Idle state - show extract button
  if (state.status === "idle") {
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
            <Button onClick={startExtraction} className="gap-2">
              <Play className="h-4 w-4" />
              Start Extraction
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (state.status === "loading") {
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
  if (state.status === "extracting") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Extracting Slides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={state.progress} className="h-2" />
          <p className="text-sm text-muted-foreground">{state.message}</p>

          {slides.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-3">
                {slides.length} slides found so far
              </p>
              <SlideGrid slides={slides} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (state.status === "error") {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <p className="text-destructive">{state.error}</p>
            <Button variant="outline" onClick={startExtraction}>
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
            Slides ({slides.length})
          </span>
          <Button variant="outline" size="sm" onClick={startExtraction}>
            Re-extract
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <SlideGrid slides={slides} />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Slide Grid
// ============================================================================

function SlideGrid({ slides }: { slides: SlideData[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {slides.map((slide) => (
        <SlideCard key={slide.slideIndex} slide={slide} />
      ))}
    </div>
  );
}

// ============================================================================
// Slide Card
// ============================================================================

function SlideCard({ slide }: { slide: SlideData }) {
  return (
    <div className="group relative rounded-lg border bg-card overflow-hidden">
      {/* Side-by-side image display */}
      <div className="aspect-video bg-muted flex">
        {/* First frame */}
        <div className="flex-1 bg-muted flex items-center justify-center relative">
          {slide.firstFrameImageUrl ? (
            <Image
              src={slide.firstFrameImageUrl}
              alt={`Slide ${slide.slideIndex + 1} - First Frame`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 25vw, (max-width: 1024px) 16.5vw, 12.5vw"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          {/* First frame label */}
          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
            First
          </div>
          {/* Indicators for first frame */}
          <div className="absolute top-1 right-1 flex flex-col gap-0.5">
            {slide.firstFrameHasText && (
              <div className="bg-blue-500/80 text-white text-xs px-1 py-0.5 rounded">
                T:{slide.firstFrameTextConfidence}%
              </div>
            )}
            {slide.firstFrameIsDuplicate && (
              <div className="bg-red-500/80 text-white text-xs px-1 py-0.5 rounded">
                DUP
              </div>
            )}
            {slide.firstFrameSkipReason && (
              <div
                className="bg-yellow-500/80 text-white text-xs px-1 py-0.5 rounded"
                title={slide.firstFrameSkipReason}
              >
                SKIP
              </div>
            )}
          </div>
        </div>

        {/* Last frame */}
        <div className="flex-1 bg-muted flex items-center justify-center relative border-l">
          {slide.lastFrameImageUrl ? (
            <Image
              src={slide.lastFrameImageUrl}
              alt={`Slide ${slide.slideIndex + 1} - Last Frame`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 25vw, (max-width: 1024px) 16.5vw, 12.5vw"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          {/* Last frame label */}
          <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
            Last
          </div>
          {/* Indicators for last frame */}
          <div className="absolute top-1 right-1 flex flex-col gap-0.5">
            {slide.lastFrameHasText && (
              <div className="bg-green-500/80 text-white text-xs px-1 py-0.5 rounded">
                T:{slide.lastFrameTextConfidence}%
              </div>
            )}
            {slide.lastFrameIsDuplicate && (
              <div className="bg-red-500/80 text-white text-xs px-1 py-0.5 rounded">
                DUP
              </div>
            )}
            {slide.lastFrameSkipReason && (
              <div
                className="bg-orange-500/80 text-white text-xs px-1 py-0.5 rounded"
                title={slide.lastFrameSkipReason}
              >
                SKIP
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs">
          <div className="space-y-1">
            {/* Timing */}
            <div className="flex justify-between items-center">
              <span>
                {formatTime(slide.startTime)} - {formatTime(slide.endTime)}
              </span>
              <div className="flex gap-1">
                {slide.firstFrameHasText && slide.lastFrameHasText && (
                  <span className="bg-purple-500/80 px-1.5 rounded">
                    Both have text
                  </span>
                )}
                {slide.firstFrameIsDuplicate && slide.lastFrameIsDuplicate && (
                  <span className="bg-red-500/80 px-1.5 rounded">
                    Both duplicate
                  </span>
                )}
                {(slide.firstFrameSkipReason || slide.lastFrameSkipReason) && (
                  <span className="bg-yellow-500/80 px-1.5 rounded">
                    Has skips
                  </span>
                )}
              </div>
            </div>

            {/* Skip reasons */}
            {(slide.firstFrameSkipReason || slide.lastFrameSkipReason) && (
              <div className="text-xs text-yellow-200">
                {slide.firstFrameSkipReason && (
                  <div>First: {slide.firstFrameSkipReason}</div>
                )}
                {slide.lastFrameSkipReason && (
                  <div>Last: {slide.lastFrameSkipReason}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide number */}
      <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
        #{slide.slideIndex + 1}
      </div>
    </div>
  );
}
