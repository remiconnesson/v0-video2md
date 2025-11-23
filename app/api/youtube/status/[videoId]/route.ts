import { getWorkflow } from "@/lib/workflow-db"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params

  if (!videoId) {
    return NextResponse.json({ error: "Video ID is required" }, { status: 400 })
  }

  const workflow = getWorkflow(videoId)

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  // Return workflow status
  return NextResponse.json({
    isProcessing: workflow.isProcessing,
    currentStep: workflow.currentStep,
    totalSteps: workflow.totalSteps,
    steps: workflow.steps,
    extractSlides: workflow.extractSlides,
    videoData: workflow.videoData,
  })
}
