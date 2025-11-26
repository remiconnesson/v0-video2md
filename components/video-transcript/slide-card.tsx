import Image from "next/image";
import type { SlideEvent } from "@/lib/slides-extractor-types";

interface SlideCardProps {
  slide: SlideEvent;
  formatTime: (seconds: number) => string;
}

export function SlideCard({ slide, formatTime }: SlideCardProps) {
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
