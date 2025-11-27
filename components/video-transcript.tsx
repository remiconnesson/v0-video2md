"use client";

import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSlideExtraction } from "@/hooks/use-slide-extraction";
import { useVideoProcessing } from "@/hooks/use-video-processing";
import { ProcessingView } from "./video-transcript/processing-view";
import { VideoContentView } from "./video-transcript/video-content-view";

export function VideoTranscript({ youtubeId }: { youtubeId: string }) {
  const { videoStatus, video, bookContent, isLoading, error, processingState } =
    useVideoProcessing(youtubeId);

  const { slideExtraction, slides, startSlideExtraction } = useSlideExtraction(
    youtubeId,
    bookContent,
  );

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

  if (videoStatus === "processing" || videoStatus === "not_found") {
    return (
      <ProcessingView
        video={video}
        youtubeId={youtubeId}
        processingState={processingState}
        slideExtraction={slideExtraction}
        slides={slides}
        onExtractSlides={startSlideExtraction}
      />
    );
  }

  return (
    <VideoContentView
      video={video}
      youtubeId={youtubeId}
      bookContent={bookContent}
      slideExtraction={slideExtraction}
      slides={slides}
      onExtractSlides={startSlideExtraction}
    />
  );
}
