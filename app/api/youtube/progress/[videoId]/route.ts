import { getWorkflow } from "@/lib/workflow-db"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params

  if (!videoId) {
    return new Response("Video ID is required", { status: 400 })
  }

  // Create a streaming response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Poll for updates and stream them to the client
      const intervalId = setInterval(() => {
        const workflow = getWorkflow(videoId)

        if (!workflow) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Workflow not found" })}\n\n`))
          clearInterval(intervalId)
          controller.close()
          return
        }

        // Send current workflow state
        const data = {
          isProcessing: workflow.isProcessing,
          currentStep: workflow.currentStep,
          totalSteps: workflow.totalSteps,
          steps: workflow.steps,
          videoData: workflow.videoData,
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

        // If workflow is complete, close the stream
        if (!workflow.isProcessing) {
          clearInterval(intervalId)
          controller.close()
        }
      }, 1000) // Poll every second

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
