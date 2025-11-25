import { NextResponse } from "next/server"
import { processYoutubeInput } from "@/lib/youtube-utils"

export async function POST(request: Request) {
  try {
    const { input } = await request.json()

    if (!input) {
      return NextResponse.json({ error: "Input is required" }, { status: 400 })
    }

    const result = await processYoutubeInput(input)

    if (result.error) {
      return NextResponse.json({ error: result.error, videoId: null }, { status: 400 })
    }

    return NextResponse.json({
      videoId: result.videoId,
      success: true,
    })
  } catch (error) {
    console.error("Error validating YouTube input:", error)
    return NextResponse.json({ error: "Failed to validate input" }, { status: 500 })
  }
}
