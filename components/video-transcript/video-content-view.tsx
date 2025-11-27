import { ImageIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SlideExtractionState } from "@/hooks/use-slide-extraction";
import type { BookContent, VideoInfo } from "@/hooks/use-video-processing";
import type { SlideEvent } from "@/lib/slides-extractor-types";
import { ChapterSection } from "./chapter-section";
import { SlideCard } from "./slide-card";
import { SlideExtractionProgress } from "./slide-extraction-progress";
import { VideoHeader } from "./video-header";

interface VideoContentViewProps {
  video: VideoInfo | null;
  youtubeId: string;
  bookContent: BookContent | null;
  slideExtraction: SlideExtractionState;
  slides: SlideEvent[];
  onExtractSlides: () => void;
}

export function VideoContentView({
  video,
  youtubeId,
  bookContent,
  slideExtraction,
  slides,
  onExtractSlides,
}: VideoContentViewProps) {
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);

  const slidesForChapter = useMemo(() => {
    return slides.filter(
      (slide) => slide.chapter_index === selectedChapterIndex,
    );
  }, [slides, selectedChapterIndex]);

  return (
    <div className="space-y-4">
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

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 h-[calc(100vh-220px)]">
        {/* Book Content */}
        <Card className="p-6 h-full overflow-hidden">
          <ScrollArea className="h-full">
            {bookContent && (
              <div className="space-y-8">
                {/* Video Summary */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h2 className="text-xl font-semibold mb-4">Video Summary</h2>
                  <Streamdown>{bookContent.videoSummary}</Streamdown>
                </div>

                <hr className="border-border" />

                {/* Chapters */}
                {bookContent.chapters.map((chapter, index) => (
                  <ChapterSection
                    key={`${chapter.start}-${index}`}
                    chapter={chapter}
                    index={index}
                    isSelected={selectedChapterIndex === index}
                    onSelect={() => setSelectedChapterIndex(index)}
                    hasSlides={
                      slideExtraction.status === "ready" &&
                      slides.some((s) => s.chapter_index === index)
                    }
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Slides Panel */}
        <div className="flex flex-col gap-4 h-full">
          <Card className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <h3 className="font-semibold">Slides</h3>
              </div>
              {slideExtraction.status === "ready" && (
                <span className="text-xs text-muted-foreground">
                  {slidesForChapter.length} in this chapter
                </span>
              )}
            </div>

            <ScrollArea className="flex-1">
              {slideExtraction.status === "idle" && (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-4 opacity-30" />
                  <p className="text-sm">
                    Extract slides from the video to see them here
                  </p>
                </div>
              )}

              {slideExtraction.status === "extracting" &&
                slides.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p className="text-sm">Extracting slides...</p>
                  </div>
                )}

              {(slideExtraction.status === "ready" ||
                (slideExtraction.status === "extracting" &&
                  slides.length > 0)) && (
                <div className="space-y-3">
                  {slidesForChapter.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p className="text-sm">No slides in this chapter</p>
                    </div>
                  ) : (
                    slidesForChapter.map((slide) => (
                      <SlideCard key={slide.frame_id} slide={slide} />
                    ))
                  )}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
