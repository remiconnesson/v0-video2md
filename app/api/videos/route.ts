import { NextResponse } from "next/server";
import { getProcessedVideos } from "@/lib/videos";

// ============================================================================
// GET - List all processed videos (with transcripts)
// ============================================================================

export async function GET() {
  const processedVideos = await getProcessedVideos();
  return NextResponse.json(processedVideos);
}
