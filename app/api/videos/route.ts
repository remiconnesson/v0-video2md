import { NextResponse } from "next/server";
import { getProcessedVideosData } from "@/lib/video-data";

// ============================================================================
// GET - List all processed videos (with transcripts)
// ============================================================================

export async function GET() {
  const processedVideos = await getProcessedVideosData();
  return NextResponse.json(processedVideos);
}
