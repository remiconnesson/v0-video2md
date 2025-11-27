import { ImageIcon, Play } from "lucide-react";
import { Streamdown } from "streamdown";
import type { Chapter } from "@/ai/transcript-to-book-schema";
import { cn } from "@/lib/utils";

interface ChapterSectionProps {
  chapter: Chapter;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  hasSlides: boolean;
}

export function ChapterSection({
  chapter,
  index,
  isSelected,
  onSelect,
  hasSlides,
}: ChapterSectionProps) {
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
