"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ZoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title: string;
  allImages?: { url: string | null; title: string }[];
  currentIndex?: number;
}

export function ZoomDialog({
  open,
  onOpenChange,
  imageUrl,
  title,
  allImages,
  currentIndex,
}: ZoomDialogProps) {
  const [viewingIndex, setViewingIndex] = useState(currentIndex ?? 0);

  useEffect(() => {
    if (currentIndex !== undefined) {
      setViewingIndex(currentIndex);
    }
  }, [currentIndex]);

  const hasPrev = allImages && viewingIndex > 0;
  const hasNext = allImages && viewingIndex < allImages.length - 1;

  const currentImage = allImages
    ? allImages[viewingIndex]
    : { url: imageUrl, title };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">{currentImage.title}</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center bg-black/95">
          {/* Navigation buttons */}
          {hasPrev && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
              onClick={() => setViewingIndex((i) => i - 1)}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          {hasNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
              onClick={() => setViewingIndex((i) => i + 1)}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Image */}
          {currentImage.url ? (
            <div className="relative w-full h-[85vh]">
              <Image
                src={currentImage.url || "/placeholder.svg"}
                alt={currentImage.title}
                fill
                className="object-contain"
                sizes="90vw"
                priority
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[50vh]">
              <ImageIcon className="h-16 w-16 text-muted-foreground" />
            </div>
          )}

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white text-center">{currentImage.title}</p>
            {allImages && (
              <p className="text-white/60 text-center text-sm mt-1">
                {viewingIndex + 1} / {allImages.length}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
