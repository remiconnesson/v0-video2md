import { type NextRequest, NextResponse } from "next/server"
import { createWorkflow } from "@/lib/workflow-db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, extractSlides } = body

    console.log("[v0] Processing video request:", { videoId, extractSlides })

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 })
    }

    // Create workflow in mock database
    const workflow = createWorkflow(videoId, extractSlides || false)

    console.log("[v0] Workflow created:", {
      videoId,
      currentStep: workflow.currentStep,
      totalSteps: workflow.totalSteps,
    })

    // Start background processing (simulate async processing)
    // Don't await - let it run in background
    simulateWorkflowProcessing(videoId)

    return NextResponse.json({
      success: true,
      videoId,
      workflow: {
        currentStep: workflow.currentStep,
        totalSteps: workflow.totalSteps,
        steps: workflow.steps,
      },
    })
  } catch (error) {
    console.error("[v0] Error processing video:", error)
    return NextResponse.json({ error: "Failed to process video" }, { status: 500 })
  }
}

// Simulate workflow processing in background
async function simulateWorkflowProcessing(videoId: string) {
  const { getWorkflow, updateWorkflowStep, completeWorkflow } = await import("@/lib/workflow-db")

  console.log("[v0] Starting background processing for:", videoId)

  const workflow = getWorkflow(videoId)
  if (!workflow) {
    console.error("[v0] Workflow not found for:", videoId)
    return
  }

  // Simulate each step with random delays
  for (let i = 0; i < workflow.totalSteps; i++) {
    // Random delay between 2-5 seconds per step
    const delay = Math.random() * 3000 + 2000
    await new Promise((resolve) => setTimeout(resolve, delay))

    console.log("[v0] Updating workflow step:", { videoId, step: i })
    updateWorkflowStep(videoId, i)
  }

  console.log("[v0] Completing workflow for:", videoId)
  completeWorkflow(videoId, {
    title: `Sample Video Title - ${videoId}`,
    description: "This is a mock description for the processed video.",
    duration: "15:30",
    publishedAt: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    channelTitle: "Sample Channel",
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    transcriptLength: 2500,
    markdownUrl: `/downloads/${videoId}.md`,
  })
}
