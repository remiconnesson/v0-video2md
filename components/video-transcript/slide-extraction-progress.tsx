import { ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SlideExtractionState } from "@/hooks/use-slide-extraction";

interface SlideExtractionProgressProps {
  slideExtraction: SlideExtractionState;
  slidesCount: number;
  onRetry: () => void;
}

export function SlideExtractionProgress({
  slideExtraction,
  slidesCount,
  onRetry,
}: SlideExtractionProgressProps) {
  if (slideExtraction.status === "extracting") {
    return (
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
                {slidesCount} slides found
              </span>
            </div>
            <Progress value={slideExtraction.progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {slideExtraction.message}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (slideExtraction.status === "error") {
    return (
      <Card className="p-4 border-destructive bg-destructive/10">
        <p className="text-sm text-destructive">{slideExtraction.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Retry
        </Button>
      </Card>
    );
  }

  return null;
}
