import { start } from "workflow/api"
import { processVideoWorkflow } from "@/workflows/video-processing"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { videoUrl } = await request.json()

  if (!videoUrl) {
    return NextResponse.json({ error: "Video URL is required" }, { status: 400 })
  }

  // Start the workflow - executes asynchronously
  await start(processVideoWorkflow, [videoUrl])

  return NextResponse.json({
    message: "Video processing workflow started",
    videoUrl,
  })
}
