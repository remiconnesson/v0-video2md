"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { VideoInformation } from "@/components/video-information"
import { VideoWorkflowProgress } from "@/components/video-workflow-progress"
import type { WorkflowStep } from "@/lib/workflow-db"

interface WorkflowStatus {
  isProcessing: boolean
  currentStep: number
  totalSteps: number
  steps: WorkflowStep[]
  videoData?: {
    title: string
    description: string
    duration: string
    publishedAt: string
    channelTitle: string
    thumbnailUrl: string
    transcriptLength: number
    markdownUrl?: string
  }
}

export default function VideoPage({
  params,
}: {
  params: { videoId: string }
}) {
  const { videoId } = params
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let hasNavigated = false
    let isUnmounted = false
    let eventSource: EventSource | null = null

    type StreamMessage = { type: "update"; payload: WorkflowStatus } | { type: "error"; payload: { message: string } }

    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data) as StreamMessage

        if (message.type === "update") {
          setError(null)
          setWorkflowStatus(message.payload)

          if (!message.payload.isProcessing) {
            if (message.payload.videoData && !hasNavigated) {
              hasNavigated = true
              router.refresh()
            }

            eventSource?.close()
          }
        } else if (message.type === "error") {
          setError(message.payload.message)
          setWorkflowStatus(null)
          eventSource?.close()
        }
      } catch (err) {
        console.error("[v0] Error parsing SSE message:", err)
        setError("Received malformed update from server")
        eventSource?.close()
      }
    }

    eventSource = new EventSource(`/api/youtube/progress/${videoId}`)
    eventSource.onmessage = handleMessage
    eventSource.onerror = (error) => {
      console.error("[v0] SSE error:", error)
      if (!isUnmounted) {
        setError("Failed to connect to server")
      }
      eventSource?.close()
    }

    return () => {
      isUnmounted = true
      eventSource?.close()
    }
  }, [videoId, router])

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Link href="/">
            <Button variant="ghost" className="mb-6 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Error</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!workflowStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center">
            <p className="text-muted-foreground">Loading workflow status...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        {workflowStatus.isProcessing ? (
          <VideoWorkflowProgress
            videoId={videoId}
            currentStep={workflowStatus.currentStep}
            totalSteps={workflowStatus.totalSteps}
            steps={workflowStatus.steps}
          />
        ) : workflowStatus.videoData ? (
          <VideoInformation videoId={videoId} data={workflowStatus.videoData} />
        ) : (
          <VideoWorkflowProgress
            videoId={videoId}
            currentStep={0}
            totalSteps={workflowStatus.totalSteps}
            steps={workflowStatus.steps}
          />
        )}
      </div>
    </div>
  )
}
