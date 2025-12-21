"use client"

import { X } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
      <div className="space-y-1.5">
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

            <div className="flex gap-1.5 flex-1">
              {/* First frame */}
              <div className="relative flex-1 aspect-video rounded overflow-hidden border">
                {slide.firstFrameImageUrl ? (
                  <Image
                    src={slide.firstFrameImageUrl || "/placeholder.svg"}
                    alt={`Slide ${slide.slideNumber} first frame`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
                {/* First frame badge */}
                <Badge className="absolute bottom-0.5 right-0.5 h-3.5 px-1 text-[9px] leading-none">
                  #{slide.slideNumber}.F
                </Badge>
              </div>

              {/* Last frame */}
              <div className="relative flex-1 aspect-video rounded overflow-hidden border">
                {slide.lastFrameImageUrl ? (
                  <Image
                    src={slide.lastFrameImageUrl || "/placeholder.svg"}
                    alt={`Slide ${slide.slideNumber} last frame`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
                {/* Last frame badge */}
                <Badge className="absolute bottom-0.5 right-0.5 h-3.5 px-1 text-[9px] leading-none">
                  #{slide.slideNumber}.L
                </Badge>
              </div>
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
