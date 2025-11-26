import { BookOpen, ImageIcon, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SlideExtractionState } from "@/hooks/use-slide-extraction";
import type { ProcessingState, VideoInfo } from "@/hooks/use-video-processing";
import type { SlideEvent } from "@/lib/slides-extractor-types";
import { formatTime } from "@/lib/time-utils";
import { SlideCard } from "./slide-card";
import { SlideExtractionProgress } from "./slide-extraction-progress";
import { VideoHeader } from "./video-header";

interface ProcessingViewProps {
  video: VideoInfo | null;
  youtubeId: string;
  processingState: ProcessingState;
  slideExtraction: SlideExtractionState;
  slides: SlideEvent[];
  onExtractSlides: () => void;
}

export function ProcessingView({
  video,
  youtubeId,
  processingState,
  slideExtraction,
  slides,
  onExtractSlides,
}: ProcessingViewProps) {
  return (
    <div className="space-y-6">
      <VideoHeader
        video={video}
        youtubeId={youtubeId}
        slideExtractionStatus={slideExtraction.status}
        onExtractSlides={onExtractSlides}
      />

      <SlideExtractionProgress
        slideExtraction={slideExtraction}
        slidesCount={slides.length}
        onRetry={onExtractSlides}
      />

      <Card className="p-8 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
          <div className="relative">
            <BookOpen className="h-16 w-16 text-muted-foreground" />
            <Loader2 className="h-8 w-8 animate-spin text-primary absolute -bottom-2 -right-2" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Analyzing Video Content</h2>
            <p className="text-muted-foreground max-w-md">
              We're fetching the transcript and generating a detailed
              chapter-by-chapter analysis for you.
            </p>
          </div>
          <div className="w-full max-w-md space-y-2">
            <Progress value={processingState.progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {processingState.message}
            </p>
          </div>
        </div>
      </Card>

      {(slideExtraction.status === "extracting" ||
        slideExtraction.status === "ready") &&
        slides.length > 0 && (
          <Card className="p-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <h3 className="font-semibold">Extracted Slides</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {slides.length} slides
              </span>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {slides.map((slide) => (
                  <SlideCard
                    key={slide.frame_id}
                    slide={slide}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
    </div>
  );
}
