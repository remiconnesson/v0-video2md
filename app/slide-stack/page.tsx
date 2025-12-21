"use client"

import { useState, useCallback } from "react"
import { SlideStack } from "@/components/analyze/slide-stack"
import { useDragDrop } from "@/hooks/use-drag-drop"
import type { SlideData } from "@/lib/slides-types"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GripVertical, Layers, Info } from "lucide-react"
import Image from "next/image"

const MOCK_SLIDES: SlideData[] = [
  {
    slideNumber: 1,
    startTime: 0,
    endTime: 3,
    firstFrameImageUrl: "/slide-1-introduction.jpg",
    lastFrameImageUrl: "/slide-1-introduction.jpg",
    firstFrameIsDuplicate: false,
    firstFrameDuplicateOfSlideNumber: null,
    firstFrameDuplicateOfFramePosition: null,
    lastFrameIsDuplicate: false,
    lastFrameDuplicateOfSlideNumber: null,
    lastFrameDuplicateOfFramePosition: null,
  },
  {
    slideNumber: 2,
    startTime: 3,
    endTime: 6,
    firstFrameImageUrl: "/slide-2-overview-chart.jpg",
    lastFrameImageUrl: "/slide-2-overview-chart.jpg",
    firstFrameIsDuplicate: false,
    firstFrameDuplicateOfSlideNumber: null,
    firstFrameDuplicateOfFramePosition: null,
    lastFrameIsDuplicate: false,
    lastFrameDuplicateOfSlideNumber: null,
    lastFrameDuplicateOfFramePosition: null,
  },
  {
    slideNumber: 3,
    startTime: 6,
    endTime: 9,
    firstFrameImageUrl: "/slide-3-data-analysis.jpg",
    lastFrameImageUrl: "/slide-3-data-analysis.jpg",
    firstFrameIsDuplicate: false,
    firstFrameDuplicateOfSlideNumber: null,
    firstFrameDuplicateOfFramePosition: null,
    lastFrameIsDuplicate: false,
    lastFrameDuplicateOfSlideNumber: null,
    lastFrameDuplicateOfFramePosition: null,
  },
  {
    slideNumber: 4,
    startTime: 9,
    endTime: 12,
    firstFrameImageUrl: "/slide-4-statistics-graph.jpg",
    lastFrameImageUrl: "/slide-4-statistics-graph.jpg",
    firstFrameIsDuplicate: false,
    firstFrameDuplicateOfSlideNumber: null,
    firstFrameDuplicateOfFramePosition: null,
    lastFrameIsDuplicate: false,
    lastFrameDuplicateOfSlideNumber: null,
    lastFrameDuplicateOfFramePosition: null,
  },
  {
    slideNumber: 5,
    startTime: 12,
    endTime: 15,
    firstFrameImageUrl: "/slide-5-summary-results.jpg",
    lastFrameImageUrl: "/slide-5-summary-results.jpg",
    firstFrameIsDuplicate: false,
    firstFrameDuplicateOfSlideNumber: null,
    firstFrameDuplicateOfFramePosition: null,
    lastFrameIsDuplicate: false,
    lastFrameDuplicateOfSlideNumber: null,
    lastFrameDuplicateOfFramePosition: null,
  },
  {
    slideNumber: 6,
    startTime: 15,
    endTime: 18,
    firstFrameImageUrl: "/slide-6-conclusion.jpg",
    lastFrameImageUrl: "/slide-6-conclusion.jpg",
    firstFrameIsDuplicate: false,
    firstFrameDuplicateOfSlideNumber: null,
    firstFrameDuplicateOfFramePosition: null,
    lastFrameIsDuplicate: false,
    lastFrameDuplicateOfSlideNumber: null,
    lastFrameDuplicateOfFramePosition: null,
  },
]

interface SlideGroup {
  id: string
  slides: SlideData[]
}

export default function SlideStackShowcase() {
  const [groups, setGroups] = useState<SlideGroup[]>(
    MOCK_SLIDES.map((slide) => ({
      id: `group-${slide.slideNumber}`,
      slides: [slide],
    })),
  )
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null)
  const { draggedSlide, dragOverSlide, isDragging, handleDragStart, handleDragOver, handleDragEnd, clearDragOver } =
    useDragDrop()

  const handleDrop = useCallback(
    (targetSlideNumber: number) => {
      console.log("[v0] Drop event:", { draggedSlide, targetSlideNumber })

      if (!draggedSlide || draggedSlide === targetSlideNumber) {
        handleDragEnd()
        return
      }

      setGroups((prevGroups) => {
        // Find source and target groups
        const sourceGroupIndex = prevGroups.findIndex((g) => g.slides.some((s) => s.slideNumber === draggedSlide))
        const targetGroupIndex = prevGroups.findIndex((g) => g.slides.some((s) => s.slideNumber === targetSlideNumber))

        console.log("[v0] Group indices:", { sourceGroupIndex, targetGroupIndex })

        if (sourceGroupIndex === -1 || targetGroupIndex === -1) return prevGroups

        const newGroups = [...prevGroups]
        const sourceGroup = { ...newGroups[sourceGroupIndex], slides: [...newGroups[sourceGroupIndex].slides] }
        const targetGroup = { ...newGroups[targetGroupIndex], slides: [...newGroups[targetGroupIndex].slides] }

        if (sourceGroup.slides.length === 1 || sourceGroup.slides.some((s) => s.slideNumber === draggedSlide)) {
          // Add all slides from source to target
          targetGroup.slides.push(...sourceGroup.slides)

          console.log("[v0] Target group after merge:", {
            id: targetGroup.id,
            slideCount: targetGroup.slides.length,
            slideNumbers: targetGroup.slides.map((s) => s.slideNumber),
          })

          // Update the groups array
          newGroups[targetGroupIndex] = targetGroup

          // Remove source group entirely
          newGroups.splice(sourceGroupIndex, 1)

          return newGroups
        }

        return prevGroups
      })

      handleDragEnd()
    },
    [draggedSlide, handleDragEnd],
  )

  const handleUnstack = useCallback((slideNumber: number) => {
    setGroups((prevGroups) => {
      const sourceGroupIndex = prevGroups.findIndex((g) => g.slides.some((s) => s.slideNumber === slideNumber))
      if (sourceGroupIndex === -1) return prevGroups

      const newGroups = [...prevGroups]
      const sourceGroup = newGroups[sourceGroupIndex]

      // Find the slide to unstack
      const slideToUnstack = sourceGroup.slides.find((s) => s.slideNumber === slideNumber)
      if (!slideToUnstack) return prevGroups

      // Remove from source group
      sourceGroup.slides = sourceGroup.slides.filter((s) => s.slideNumber !== slideNumber)

      // Create new group for unstacked slide
      const newGroup: SlideGroup = {
        id: `group-${slideNumber}-${Date.now()}`,
        slides: [slideToUnstack],
      }

      // Insert new group after source group
      newGroups.splice(sourceGroupIndex + 1, 0, newGroup)

      // Remove source group if empty
      if (sourceGroup.slides.length === 0) {
        newGroups.splice(sourceGroupIndex, 1)
      }

      return newGroups
    })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
              <Layers className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Slide Stacking Demo</h1>
              <p className="text-muted-foreground">Drag and drop slides to group similar content together</p>
            </div>
          </div>

          {/* Instructions card */}
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="flex gap-3 p-4">
              <Info className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-2 text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">How to use:</p>
                <ul className="list-disc space-y-1 pl-5 text-blue-800 dark:text-blue-200">
                  <li>Click and drag the grip handle on any slide card</li>
                  <li>Drop it onto another slide to create or add to a stack</li>
                  <li>You can stack unlimited slides together</li>
                  <li>Each slide shows first frame (.F) and last frame (.L) thumbnails</li>
                  <li>Use the X button to unstack individual slides</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <div className="flex gap-4">
            <Badge variant="secondary" className="h-8 gap-2">
              <span className="text-xs text-muted-foreground">Total Slides:</span>
              <span className="font-semibold">{MOCK_SLIDES.length}</span>
            </Badge>
            <Badge variant="secondary" className="h-8 gap-2">
              <span className="text-xs text-muted-foreground">Groups:</span>
              <span className="font-semibold">{groups.length}</span>
            </Badge>
            <Badge variant="secondary" className="h-8 gap-2">
              <span className="text-xs text-muted-foreground">Stacks:</span>
              <span className="font-semibold">{groups.filter((g) => g.slides.length > 1).length}</span>
            </Badge>
          </div>
        </div>

        {/* Slides Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const isStack = group.slides.length > 1
            const primarySlide = group.slides[0]

            return (
              <div key={group.id} className="relative">
                {isStack ? (
                  // Stacked slides display
                  <Card
                    className={cn(
                      "overflow-hidden transition-all",
                      isDragging && draggedSlide === primarySlide.slideNumber && "opacity-50",
                      dragOverSlide === primarySlide.slideNumber && "ring-2 ring-primary ring-offset-2",
                    )}
                    draggable
                    onDragStart={() => handleDragStart(primarySlide.slideNumber)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      handleDragOver(primarySlide.slideNumber)
                    }}
                    onDragLeave={clearDragOver}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleDrop(primarySlide.slideNumber)
                    }}
                  >
                    {/* Drag handle for stacks */}
                    <div className="flex cursor-grab items-center gap-2 border-b bg-muted/30 px-3 py-2 active:cursor-grabbing">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {group.slides.length} slides stacked
                      </span>
                    </div>
                    <div className="p-4">
                      <SlideStack
                        slides={group.slides}
                        onUnstack={handleUnstack}
                        onSelectSlide={setSelectedSlide}
                        selectedSlideNumber={selectedSlide}
                      />
                    </div>
                  </Card>
                ) : (
                  // Single slide card with drag handle
                  <Card
                    className={cn(
                      "overflow-hidden transition-all",
                      isDragging && draggedSlide === primarySlide.slideNumber && "opacity-50",
                      dragOverSlide === primarySlide.slideNumber && "ring-2 ring-primary ring-offset-2",
                    )}
                    draggable
                    onDragStart={() => handleDragStart(primarySlide.slideNumber)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      handleDragOver(primarySlide.slideNumber)
                    }}
                    onDragLeave={clearDragOver}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleDrop(primarySlide.slideNumber)
                    }}
                  >
                    {/* Drag handle */}
                    <div className="flex cursor-grab items-center gap-2 border-b bg-muted/30 px-3 py-2 active:cursor-grabbing">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">
                        #{primarySlide.slideNumber}
                      </Badge>
                    </div>

                    <div className="p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {/* First frame */}
                        <div className="space-y-1">
                          <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                            {primarySlide.firstFrameImageUrl ? (
                              <Image
                                src={primarySlide.firstFrameImageUrl || "/placeholder.svg"}
                                alt={`Slide ${primarySlide.slideNumber} first frame`}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <span className="text-xs text-muted-foreground">No image</span>
                              </div>
                            )}
                            <Badge className="absolute bottom-1 right-1 h-4 px-1.5 text-[10px]">
                              #{primarySlide.slideNumber}.F
                            </Badge>
                          </div>
                        </div>

                        {/* Last frame */}
                        <div className="space-y-1">
                          <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
                            {primarySlide.lastFrameImageUrl ? (
                              <Image
                                src={primarySlide.lastFrameImageUrl || "/placeholder.svg"}
                                alt={`Slide ${primarySlide.slideNumber} last frame`}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <span className="text-xs text-muted-foreground">No image</span>
                              </div>
                            )}
                            <Badge className="absolute bottom-1 right-1 h-4 px-1.5 text-[10px]">
                              #{primarySlide.slideNumber}.L
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="mt-2 text-xs text-muted-foreground text-center">
                        {primarySlide.startTime}s - {primarySlide.endTime}s
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
