"use client";

import { ImageIcon, Loader2, Play } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSlideExtraction } from "@/hooks/use-slide-extraction";
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
  // Filter out duplicates for display
  const uniqueSlides = slides.filter((s) => !s.isDuplicate);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {uniqueSlides.map((slide) => (
        <SlideCard key={slide.slideIndex} slide={slide} />
      ))}
    </div>
  );
}

// ============================================================================
// Slide Card
// ============================================================================

function SlideCard({ slide }: { slide: SlideData }) {
  // Generate a signed URL or use placeholder
  // For now, show a placeholder with metadata
  return (
    <div className="group relative rounded-lg border bg-card overflow-hidden">
      {/* Image placeholder - replace with actual S3 signed URL */}
      <div className="aspect-video bg-muted flex items-center justify-center">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Metadata overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs">
          <div className="flex justify-between">
            <span>
              {formatTime(slide.startTime)} - {formatTime(slide.endTime)}
            </span>
            {slide.hasText && (
              <span className="bg-white/20 px-1.5 rounded">
                Text: {slide.textConfidence}%
              </span>
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
