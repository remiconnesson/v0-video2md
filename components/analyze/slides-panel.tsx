"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import { ImageIcon, Layers, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { SlideData, SlideFeedbackData, SlideStackGroup, SlideStreamEvent, SlidesState } from "@/lib/slides-types"
import { consumeSSE } from "@/lib/sse"
import { useDragDrop } from "@/hooks/use-drag-drop"
import { SlideCard } from "./slide-card"
import { SlideStack } from "./slide-stack"
import { cn } from "@/lib/utils" // Assuming cn is a utility function for class names

interface SlidesPanelProps {
  videoId: string
}

export function SlidesPanel({ videoId }: SlidesPanelProps) {
  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "loading",
    progress: 0,
    message: "Loading slides...",
    error: null,
    slides: [],
  })

  const [feedbackMap, setFeedbackMap] = useState<Map<number, SlideFeedbackData>>(new Map())

  const [stackGroups, setStackGroups] = useState<SlideStackGroup[]>([])

  const loadSlidesState = useCallback(async () => {
    setSlidesState((prev) => ({
      ...prev,
      status: "loading",
      message: "Loading slides...",
      error: null,
    }))

    try {
      const response = await fetch(`/api/video/${videoId}/slides`)

      if (!response.ok) {
        throw new Error("Failed to load slides state")
      }

      const data = await response.json()
      const slides: SlideData[] = data.slides ?? []
      const slidesMessage = `Extracted ${data.totalSlides ?? slides.length} slides`

      switch (data.status) {
        case "completed": {
          setSlidesState({
            status: "completed",
            progress: 100,
            message: slidesMessage,
            error: null,
            slides,
          })
          return
        }
        case "in_progress":
        case "pending": {
          setSlidesState({
            status: "extracting",
            progress: 0,
            message: "Slide extraction in progress...",
            error: null,
            slides,
          })
          return
        }
        case "failed": {
          setSlidesState({
            status: "error",
            progress: 0,
            message: "",
            error: data.errorMessage ?? "Slide extraction failed. Please try again.",
            slides,
          })
          return
        }
        default: {
          setSlidesState({
            status: slides.length > 0 ? "completed" : "idle",
            progress: slides.length > 0 ? 100 : 0,
            message: slides.length > 0 ? slidesMessage : "",
            error: null,
            slides,
          })
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load slides."

      setSlidesState({
        status: "error",
        progress: 0,
        message: "",
        error: errorMessage,
        slides: [],
      })
    }
  }, [videoId])

  const loadFeedback = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/${videoId}/slides/feedback`)
      if (!response.ok) return

      const data = await response.json()
      const newMap = new Map<number, SlideFeedbackData>()

      const groups = new Map<string, number[]>()

      data.feedback.forEach((fb: SlideFeedbackData) => {
        newMap.set(fb.slideNumber, fb)

        if (fb.stackGroupId) {
          const existing = groups.get(fb.stackGroupId) || []
          existing.push(fb.slideNumber)
          groups.set(fb.stackGroupId, existing)
        }
      })

      setFeedbackMap(newMap)

      setStackGroups(
        Array.from(groups.entries()).map(([groupId, slideNumbers]) => ({
          groupId,
          slideNumbers: slideNumbers.sort((a, b) => {
            const orderA = newMap.get(a)?.stackOrder ?? 0
            const orderB = newMap.get(b)?.stackOrder ?? 0
            return orderA - orderB
          }),
        })),
      )
    } catch (error) {
      console.error("Failed to load slide feedback:", error)
    }
  }, [videoId])

  const submitFeedback = useCallback(
    async (feedback: SlideFeedbackData) => {
      try {
        // Optimistically update local state
        setFeedbackMap((prev) => {
          const next = new Map(prev)
          next.set(feedback.slideNumber, feedback)
          return next
        })

        const response = await fetch(`/api/video/${videoId}/slides/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedback),
        })

        if (!response.ok) {
          console.error("Failed to save slide feedback")
          // Reload to sync state
          await loadFeedback()
        }
      } catch (error) {
        console.error("Failed to save slide feedback:", error)
        // Reload to sync state
        await loadFeedback()
      }
    },
    [videoId, loadFeedback],
  )

  const createStackGroup = useCallback(
    async (sourceSlideNumber: number, targetSlideNumber: number) => {
      const sourceFeedback = feedbackMap.get(sourceSlideNumber)
      const targetFeedback = feedbackMap.get(targetSlideNumber)

      // Check if target is already in a stack
      if (targetFeedback?.stackGroupId) {
        // Add source to existing stack
        const stackSize = stackGroups.find((g) => g.groupId === targetFeedback.stackGroupId)?.slideNumbers.length ?? 0

        await submitFeedback({
          slideNumber: sourceSlideNumber,
          ...sourceFeedback,
          stackGroupId: targetFeedback.stackGroupId,
          stackOrder: stackSize,
        })
      } else {
        // Create new stack
        const newGroupId = crypto.randomUUID()

        await Promise.all([
          submitFeedback({
            slideNumber: targetSlideNumber,
            ...targetFeedback,
            stackGroupId: newGroupId,
            stackOrder: 0,
          }),
          submitFeedback({
            slideNumber: sourceSlideNumber,
            ...sourceFeedback,
            stackGroupId: newGroupId,
            stackOrder: 1,
          }),
        ])
      }

      // Reload feedback to update stack groups
      await loadFeedback()
    },
    [feedbackMap, stackGroups, submitFeedback, loadFeedback],
  )

  const removeFromStack = useCallback(
    async (slideNumber: number) => {
      const feedback = feedbackMap.get(slideNumber)
      if (!feedback) return

      await submitFeedback({
        slideNumber,
        ...feedback,
        stackGroupId: null,
        stackOrder: null,
      })

      // Reload feedback to update stack groups
      await loadFeedback()
    },
    [feedbackMap, submitFeedback, loadFeedback],
  )

  const startExtraction = useCallback(async () => {
    // Set state to extracting
    setSlidesState((prev) => ({
      ...prev,
      status: "extracting",
      progress: 0,
      message: "Starting slides extraction...",
      error: null,
      slides: [],
    }))

    try {
      const response = await fetch(`/api/video/${videoId}/slides`, {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "!response.ok and response.json() failed" }))
        throw new Error(errorData.error)
      }

      // Consume SSE stream
      await consumeSSE<SlideStreamEvent>(response, {
        progress: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "extracting",
            progress: e.progress ?? prev.progress,
            message: e.message ?? prev.message,
          }))
        },
        slide: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            slides: [...prev.slides, e.slide],
          }))
        },
        complete: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "completed",
            progress: 100,
            message: `Extracted ${e.totalSlides} slides`,
            error: null,
          }))
        },
        error: (e) => {
          setSlidesState((prev) => ({
            ...prev,
            status: "error",
            progress: 0,
            message: "",
            error: e.message,
          }))
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to extract slides."

      setSlidesState((prev) => ({
        ...prev,
        status: "error",
        progress: 0,
        message: "",
        error: errorMessage,
      }))
    }
  }, [videoId])

  // Load feedback on mount
  useEffect(() => {
    loadSlidesState()
    loadFeedback()
  }, [loadFeedback, loadSlidesState])

  // Auto-trigger extraction when in idle state
  useEffect(() => {
    if (slidesState.status === "idle") {
      startExtraction()
    }
  }, [slidesState.status, startExtraction])

  // Idle state - show loading state while extraction starts
  if (slidesState.status === "idle") {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Starting slides extraction...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (slidesState.status === "loading") {
    return <LoadingState />
  }

  // Extracting state
  if (slidesState.status === "extracting") {
    return (
      <ExtractingState
        progress={slidesState.progress}
        message={slidesState.message}
        slides={slidesState.slides}
        feedbackMap={feedbackMap}
        stackGroups={stackGroups}
        onSubmitFeedback={submitFeedback}
        onCreateStackGroup={createStackGroup}
        onRemoveFromStack={removeFromStack}
      />
    )
  }

  // Error state
  if (slidesState.status === "error") {
    return <ErrorState error={slidesState.error} onRetry={startExtraction} />
  }

  // Completed state - show slides
  return (
    <CompletedState
      slidesCount={slidesState.slides.length}
      slides={slidesState.slides}
      feedbackMap={feedbackMap}
      stackGroups={stackGroups}
      onSubmitFeedback={submitFeedback}
      onCreateStackGroup={createStackGroup}
      onRemoveFromStack={removeFromStack}
    />
  )
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading slides...</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ExtractingState({
  progress,
  message,
  slides,
  feedbackMap,
  stackGroups,
  onSubmitFeedback,
  onCreateStackGroup,
  onRemoveFromStack,
}: {
  progress: number
  message: string
  slides: SlideData[]
  feedbackMap: Map<number, SlideFeedbackData>
  stackGroups: SlideStackGroup[]
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>
  onCreateStackGroup: (source: number, target: number) => Promise<void>
  onRemoveFromStack: (slideNumber: number) => Promise<void>
}) {
  const hasSlidesFound = slides.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Extracting Slides
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground">{message}</p>

        {hasSlidesFound && (
          <div className="mt-6">
            <p className="text-sm font-medium mb-3">{slides.length} slides found so far</p>
            <SlideGrid
              slides={slides}
              allSlides={slides}
              feedbackMap={feedbackMap}
              stackGroups={stackGroups}
              onSubmitFeedback={onSubmitFeedback}
              onCreateStackGroup={onCreateStackGroup}
              onRemoveFromStack={onRemoveFromStack}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CompletedState({
  slidesCount,
  slides,
  feedbackMap,
  stackGroups,
  onSubmitFeedback,
  onCreateStackGroup,
  onRemoveFromStack,
}: {
  slidesCount: number
  slides: SlideData[]
  feedbackMap: Map<number, SlideFeedbackData>
  stackGroups: SlideStackGroup[]
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>
  onCreateStackGroup: (source: number, target: number) => Promise<void>
  onRemoveFromStack: (slideNumber: number) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Slides ({slidesCount})
          </span>
          {stackGroups.length > 0 && (
            <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
              <Layers className="h-4 w-4" />
              {stackGroups.length} stack{stackGroups.length > 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <SlideGrid
          slides={slides}
          allSlides={slides}
          feedbackMap={feedbackMap}
          stackGroups={stackGroups}
          onSubmitFeedback={onSubmitFeedback}
          onCreateStackGroup={onCreateStackGroup}
          onRemoveFromStack={onRemoveFromStack}
        />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Slide Grid with Virtual Scrolling and Drag-Drop
// ============================================================================

function SlideGrid({
  slides,
  allSlides,
  feedbackMap,
  stackGroups,
  onSubmitFeedback,
  onCreateStackGroup,
  onRemoveFromStack,
}: {
  slides: SlideData[]
  allSlides: SlideData[]
  feedbackMap: Map<number, SlideFeedbackData>
  stackGroups: SlideStackGroup[]
  onSubmitFeedback: (feedback: SlideFeedbackData) => Promise<void>
  onCreateStackGroup: (source: number, target: number) => Promise<void>
  onRemoveFromStack: (slideNumber: number) => Promise<void>
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const dragDrop = useDragDrop()

  const [selectedStackSlide, setSelectedStackSlide] = useState<Map<string, number>>(new Map())

  const displayedSlides = slides.filter((slide) => {
    const feedback = feedbackMap.get(slide.slideNumber)
    if (!feedback?.stackGroupId) return true

    // Show only the selected slide from each stack (or first if none selected)
    const group = stackGroups.find((g) => g.groupId === feedback.stackGroupId)
    if (!group) return true

    const selected = selectedStackSlide.get(feedback.stackGroupId)
    return selected ? slide.slideNumber === selected : slide.slideNumber === group.slideNumbers[0]
  })

  const virtualizer = useVirtualizer({
    count: displayedSlides.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 500, // Estimated height of each slide card
    overscan: 2, // Number of items to render outside of the visible area
  })

  const handleDrop = useCallback(
    (targetSlideNumber: number) => {
      if (dragDrop.draggedSlide && dragDrop.draggedSlide !== targetSlideNumber) {
        onCreateStackGroup(dragDrop.draggedSlide, targetSlideNumber)
      }
      dragDrop.handleDragEnd()
    },
    [dragDrop, onCreateStackGroup],
  )

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const slide = displayedSlides[virtualItem.index]
          const feedback = feedbackMap.get(slide.slideNumber)
          const stackGroup = feedback?.stackGroupId
            ? stackGroups.find((g) => g.groupId === feedback.stackGroupId)
            : null
          const stackedSlides = stackGroup
            ? stackGroup.slideNumbers
                .map((num) => allSlides.find((s) => s.slideNumber === num))
                .filter((s): s is SlideData => s !== undefined)
            : null

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-6">
                <div
                  draggable
                  onDragStart={() => dragDrop.handleDragStart(slide.slideNumber)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    dragDrop.handleDragOver(slide.slideNumber)
                  }}
                  onDragLeave={() => dragDrop.clearDragOver()}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(slide.slideNumber)
                  }}
                  onDragEnd={dragDrop.handleDragEnd}
                  className={cn(
                    "cursor-move transition-all",
                    dragDrop.isDragging && dragDrop.draggedSlide === slide.slideNumber && "opacity-50",
                    dragDrop.dragOverSlide === slide.slideNumber &&
                      dragDrop.draggedSlide !== slide.slideNumber &&
                      "ring-2 ring-blue-500 ring-offset-2 rounded-lg",
                  )}
                >
                  {stackedSlides && stackedSlides.length > 1 ? (
                    <div className="space-y-4 p-4 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                      <SlideStack
                        slides={stackedSlides}
                        onUnstack={onRemoveFromStack}
                        onSelectSlide={(slideNum) => {
                          if (feedback?.stackGroupId) {
                            setSelectedStackSlide((prev) => {
                              const next = new Map(prev)
                              next.set(feedback.stackGroupId!, slideNum)
                              return next
                            })
                          }
                        }}
                        selectedSlideNumber={
                          selectedStackSlide.get(feedback?.stackGroupId!) ?? stackedSlides[0]?.slideNumber
                        }
                      />
                      <SlideCard
                        slide={
                          stackedSlides.find(
                            (s) =>
                              s.slideNumber ===
                              (selectedStackSlide.get(feedback?.stackGroupId!) ?? stackedSlides[0]?.slideNumber),
                          ) ?? slide
                        }
                        allSlides={allSlides}
                        initialFeedback={feedbackMap.get(slide.slideNumber)}
                        onSubmitFeedback={onSubmitFeedback}
                      />
                    </div>
                  ) : (
                    <SlideCard
                      slide={slide}
                      allSlides={allSlides}
                      initialFeedback={feedbackMap.get(slide.slideNumber)}
                      onSubmitFeedback={onSubmitFeedback}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
