import Image from "next/image";
import type { SlideEvent } from "@/lib/slides-extractor-types";
import { formatTime } from "@/lib/time-utils";

interface SlideCardProps {
  slide: SlideEvent;
}

export function SlideCard({ slide }: SlideCardProps) {
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
