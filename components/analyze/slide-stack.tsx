"use client"

import { Layers, X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { SlideData } from "@/lib/slides-types"
import { cn } from "@/lib/utils"

interface SlideStackProps {
  slides: SlideData[]
  onUnstack: (slideNumber: number) => void
  onSelectSlide: (slideNumber: number) => void
  selectedSlideNumber?: number
}

export function SlideStack({ slides, onUnstack, onSelectSlide, selectedSlideNumber }: SlideStackProps) {
  const primarySlide = slides[0]

  if (!primarySlide) return null

  return (
    <div className="space-y-2">
      {/* Stack indicator badge */}
      <div className="flex items-center gap-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-md w-fit">
        <Layers className="h-3 w-3 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{slides.length} stacked slides</span>
      </div>

      {/* Stacked slide thumbnails */}
      <div className="space-y-2">
        {slides.map((slide, index) => (
          <div
            key={slide.slideNumber}
            className={cn(
              "flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer",
              selectedSlideNumber === slide.slideNumber
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                : "bg-muted/30 hover:bg-muted/50",
            )}
            onClick={() => onSelectSlide(slide.slideNumber)}
          >
            {/* Order badge */}
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
              {index + 1}
            </div>

            {/* Thumbnail */}
            <div className="relative w-16 h-9 rounded overflow-hidden border flex-shrink-0">
              {slide.firstFrameImageUrl ? (
                <Image
                  src={slide.firstFrameImageUrl || "/placeholder.svg"}
                  alt={`Slide ${slide.slideNumber}`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
            </div>

            {/* Slide info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Slide #{slide.slideNumber}</div>
            </div>

            {/* Unstack button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onUnstack(slide.slideNumber)
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
