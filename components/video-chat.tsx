"use client";

import { BookOpen, ExternalLink, ImageIcon, Loader2, Play } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import type { Chapter } from "@/ai/transcript-to-book-schema";
import type { TranscriptWorkflowEvent } from "@/app/workflows/fetch-transcript";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  SlideEvent,
  SlideStreamEvent,
} from "@/lib/slides-extractor-types";
import { JobStatus } from "@/lib/slides-extractor-types";
import { cn } from "@/lib/utils";
import { fetchYoutubeVideoTitle } from "@/lib/youtube-utils";

interface VideoInfo {
  videoId: string;
  url: string;
  title: string;
  channelName?: string;
  description?: string;
  thumbnail?: string;
}

interface BookContent {
  videoSummary: string;
  chapters: Chapter[];
}

type VideoStatus = "not_found" | "processing" | "ready";

type SlideExtractionStatus = "idle" | "extracting" | "ready" | "error";

interface ProcessingState {
  step: string;
  message: string;
  progress: number;
}

interface SlideExtractionState {
  status: SlideExtractionStatus;
  message: string;
  progress: number;
  runId?: string;
}

const STEP_PROGRESS: Record<string, number> = {
  fetching: 20,
  saving: 40,
  analyzing: 70,
  finalizing: 90,
};

const JOB_STATUS_PROGRESS: Record<JobStatus, number> = {
  [JobStatus.PENDING]: 10,
  [JobStatus.DOWNLOADING]: 30,
  [JobStatus.EXTRACTING]: 60,
  [JobStatus.UPLOADING]: 80,
  [JobStatus.COMPLETED]: 100,
  [JobStatus.FAILED]: 0,
};

export function VideoChat({ youtubeId }: { youtubeId: string }) {
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [bookContent, setBookContent] = useState<BookContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    step: "",
    message: "Starting...",
    progress: 0,
  });

  // Slide extraction state
  const [slideExtraction, setSlideExtraction] = useState<SlideExtractionState>({
    status: "idle",
    message: "",
    progress: 0,
  });
  const [slides, setSlides] = useState<SlideEvent[]>([]);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);

  // Start the transcript processing workflow and consume the stream
  const startProcessing = useCallback(async () => {
    setVideoStatus("processing");
    setProcessingState({ step: "", message: "Starting...", progress: 5 });
    let completed = false;

    // Attempt to fetch the video title early to display in the header
    fetchYoutubeVideoTitle(youtubeId)
      .then((title) => {
        if (title) {
          setVideo((prev) => ({
            videoId: youtubeId,
            url: `https://www.youtube.com/watch?v=${youtubeId}`,
            title,
            ...(prev || {}),
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to fetch video title:", error);
      });

    try {
      const response = await fetch(`/api/video/${youtubeId}/process`, {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start processing");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: TranscriptWorkflowEvent = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                setProcessingState({
                  step: event.step,
                  message: event.message,
                  progress: STEP_PROGRESS[event.step] || 50,
                });
              } else if (event.type === "complete") {
                setBookContent(event.bookContent);
                setVideoStatus("ready");
                completed = true;
                setProcessingState({
                  step: "complete",
                  message: "Complete!",
                  progress: 100,
                });
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch (parseError) {
              // Only ignore JSON parse errors; propagate other errors
              if (parseError instanceof SyntaxError) {
                // Ignore malformed SSE lines
              } else {
                throw parseError;
              }
            }
          }
        }
      }

      // If we finished without getting a complete event, refetch video data
      if (!completed) {
        const videoRes = await fetch(`/api/video/${youtubeId}`);
        const data = await videoRes.json();
        if (data.status === "ready") {
          setVideo(data.video);
          setBookContent(data.bookContent);
          setVideoStatus("ready");
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Processing failed";
      setError(errorMessage);
      setVideoStatus(null);
    }
  }, [youtubeId]);

  // Start slide extraction workflow
  const startSlideExtraction = useCallback(async () => {
    setSlideExtraction({
      status: "extracting",
      message: "Starting slide extraction...",
      progress: 5,
    });
    setSlides([]);

    try {
      const response = await fetch(`/api/video/${youtubeId}/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapters: bookContent?.chapters,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start slide extraction");
      }

      const runId = response.headers.get("X-Workflow-Run-Id");
      if (runId) {
        setSlideExtraction((prev) => ({ ...prev, runId }));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: SlideStreamEvent = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                const progressData = event.data as {
                  status: JobStatus;
                  progress: number;
                  message: string;
                };
                setSlideExtraction({
                  status: "extracting",
                  message: progressData.message,
                  progress:
                    JOB_STATUS_PROGRESS[progressData.status] ||
                    progressData.progress,
                  runId: runId ?? undefined,
                });
              } else if (event.type === "slide") {
                const slideData = event.data as SlideEvent;
                setSlides((prev) => [...prev, slideData]);
              } else if (event.type === "complete") {
                setSlideExtraction({
                  status: "ready",
                  message: "Slides extracted successfully!",
                  progress: 100,
                  runId: runId ?? undefined,
                });
              } else if (event.type === "error") {
                const errorData = event.data as { message: string };
                throw new Error(errorData.message);
              }
            } catch (parseError) {
              // Only ignore JSON parse errors; propagate other errors
              if (parseError instanceof SyntaxError) {
                // Ignore malformed SSE lines
              } else {
                throw parseError;
              }
            }
          }
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Slide extraction failed";
      setSlideExtraction({
        status: "error",
        message: errorMessage,
        progress: 0,
      });
    }
  }, [youtubeId, bookContent]);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const videoRes = await fetch(`/api/video/${youtubeId}`);

        if (!videoRes.ok) {
          setError(
            `Failed to load video: ${videoRes.statusText || "Unknown error"}`,
          );
          return;
        }

        const videoData = await videoRes.json();

        if (videoData.status === "not_found") {
          setVideoStatus("not_found");
          setIsLoading(false);
          startProcessing();
          return;
        }

        if (videoData.status === "processing") {
          setVideo(videoData.video);
          setVideoStatus("processing");
          setIsLoading(false);
          startProcessing();
          return;
        }

        // Video is ready
        setVideo(videoData.video);
        setBookContent(videoData.bookContent);
        setVideoStatus("ready");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch data";
        console.error("[VideoChat] Error fetching data:", err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [youtubeId, startProcessing]);

  // Get slides for the selected chapter
  const slidesForChapter = useMemo(() => {
    return slides.filter(
      (slide) => slide.chapter_index === selectedChapterIndex,
    );
  }, [slides, selectedChapterIndex]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-destructive bg-destructive/10 p-6 max-w-md">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Please try refreshing the page.
          </p>
        </Card>
      </div>
    );
  }

  // Processing state UI
  if (videoStatus === "processing" || videoStatus === "not_found") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b">
          <h1 className="text-2xl font-bold">
            {video?.title || `Processing Video...`}
          </h1>
          <div className="flex items-center gap-2">
            {slideExtraction.status === "idle" && (
              <Button
                variant="default"
                onClick={startSlideExtraction}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Extract Slides
              </Button>
            )}
            <Button variant="outline" asChild>
              <a
                href={`https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                Watch Video
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Slide Extraction Progress */}
        {slideExtraction.status === "extracting" && (
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <ImageIcon className="h-8 w-8 text-primary" />
                <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">Extracting Slides</p>
                  <span className="text-xs text-muted-foreground">
                    {slides.length} slides found
                  </span>
                </div>
                <Progress value={slideExtraction.progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {slideExtraction.message}
                </p>
              </div>
            </div>
          </Card>
        )}

        {slideExtraction.status === "error" && (
          <Card className="p-4 border-destructive bg-destructive/10">
            <p className="text-sm text-destructive">
              {slideExtraction.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={startSlideExtraction}
              className="mt-2"
            >
              Retry
            </Button>
          </Card>
        )}

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

        {/* Slides Panel during processing */}
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

  // Ready or processing state UI with Extract Slides button
  return (
    <div className="space-y-4">
      {video && (
        <div className="flex items-center justify-between pb-4 border-b">
          <h1 className="text-2xl font-bold">{video.title}</h1>
          <div className="flex items-center gap-2">
            {slideExtraction.status === "idle" && (
              <Button
                variant="default"
                onClick={startSlideExtraction}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Extract Slides
              </Button>
            )}
            <Button variant="outline" asChild>
              <a
                href={`https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                Watch Video
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Slide Extraction Progress */}
      {slideExtraction.status === "extracting" && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ImageIcon className="h-8 w-8 text-primary" />
              <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Extracting Slides</p>
                <span className="text-xs text-muted-foreground">
                  {slides.length} slides found
                </span>
              </div>
              <Progress value={slideExtraction.progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {slideExtraction.message}
              </p>
            </div>
          </div>
        </Card>
      )}

      {slideExtraction.status === "error" && (
        <Card className="p-4 border-destructive bg-destructive/10">
          <p className="text-sm text-destructive">{slideExtraction.message}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={startSlideExtraction}
            className="mt-2"
          >
            Retry
          </Button>
        </Card>
      )}

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
                    key={chapter.chapterTitle}
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

              {slideExtraction.status === "extracting" && (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p className="text-sm">Extracting slides...</p>
                  {slides.length > 0 && (
                    <p className="text-xs mt-2">
                      {slides.length} slides found so far
                    </p>
                  )}
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
                      <SlideCard
                        key={slide.frame_id}
                        slide={slide}
                        formatTime={formatTime}
                      />
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

// Chapter Section Component
function ChapterSection({
  chapter,
  index,
  isSelected,
  onSelect,
  hasSlides,
}: {
  chapter: Chapter;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  hasSlides: boolean;
}) {
  return (
    <div
      className={cn(
        "relative border-l-4 pl-4 py-2 transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-muted-foreground/30",
      )}
    >
      <button
        type="button"
        className="flex items-start gap-2 mb-2 text-left w-full cursor-pointer"
        onClick={onSelect}
      >
        <h3 className="text-lg font-semibold">
          {index + 1}. {chapter.chapterTitle}
        </h3>
        {hasSlides && (
          <ImageIcon className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
        )}
      </button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <Play className="h-3 w-3" />
        <span>{chapter.start}</span>
      </div>
      <blockquote className="text-sm italic text-muted-foreground border-l-2 border-muted pl-3 mb-4">
        {chapter.chapterSummary}
      </blockquote>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <Streamdown>{chapter.bookChapter}</Streamdown>
      </div>
    </div>
  );
}

// Slide Card Component
function SlideCard({
  slide,
  formatTime,
}: {
  slide: SlideEvent;
  formatTime: (seconds: number) => string;
}) {
  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <div className="aspect-video bg-muted relative">
        <Image
          src={slide.image_url}
          alt={`Slide at ${formatTime(slide.start_time)}`}
          fill
          sizes="400px"
          className="object-contain"
        />
      </div>
      <div className="p-2 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {formatTime(slide.start_time)} - {formatTime(slide.end_time)}
        </span>
        {slide.has_text && <span className="text-primary">Has text</span>}
      </div>
    </div>
  );
}
