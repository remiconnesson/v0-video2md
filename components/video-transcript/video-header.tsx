import { ExternalLink, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SlideExtractionStatus } from "@/hooks/use-slide-extraction";
import type { VideoInfo } from "@/hooks/use-video-processing";

interface VideoHeaderProps {
  video: VideoInfo | null;
  youtubeId: string;
  slideExtractionStatus: SlideExtractionStatus;
  onExtractSlides: () => void;
}

export function VideoHeader({
  video,
  youtubeId,
  slideExtractionStatus,
  onExtractSlides,
}: VideoHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-4 border-b">
      <h1 className="text-2xl font-bold">
        {video?.title || "Processing Video..."}
      </h1>
      <div className="flex items-center gap-2">
        {slideExtractionStatus === "idle" && (
          <Button variant="default" onClick={onExtractSlides} className="gap-2">
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
  );
}
