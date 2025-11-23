import { createWorkflow } from "@/lib/workflow-db"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, extractSlides } = body

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 })
    }

    // Create workflow in mock database
    const workflow = createWorkflow(videoId, extractSlides || false)

    // Start background processing (simulate async processing)
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
    console.error("Error processing video:", error)
    return NextResponse.json({ error: "Failed to process video" }, { status: 500 })
  }
}

// Simulate workflow processing in background
async function simulateWorkflowProcessing(videoId: string) {
  const { getWorkflow, updateWorkflowStep, completeWorkflow } = await import("@/lib/workflow-db")

  const workflow = getWorkflow(videoId)
  if (!workflow) return

  // Simulate each step with random delays
  for (let i = 0; i < workflow.totalSteps; i++) {
    // Random delay between 2-5 seconds per step
    const delay = Math.random() * 3000 + 2000
    await new Promise((resolve) => setTimeout(resolve, delay))

    updateWorkflowStep(videoId, i)
  }

  // Complete workflow with mock data
  completeWorkflow(videoId, {
    title: "Sample Video Title - " + videoId,
    description: "This is a mock description for the processed video.",
    duration: "15:30",
    thumbnail: `/placeholder.svg?height=360&width=640&query=video-thumbnail-${videoId}`,
    markdownContent: `# Video Transcript\n\nThis is the generated markdown content for video ${videoId}.\n\n## Main Points\n\n- Point 1: Introduction\n- Point 2: Main content\n- Point 3: Conclusion\n\n## Detailed Transcript\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit...`,
  })
}
