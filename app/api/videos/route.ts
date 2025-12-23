import { NextResponse } from "next/server";
import { getProcessedVideosWithStatus } from "@/db/queries";
import { formatDuration } from "@/lib/time-utils";

// ============================================================================
// GET - List all processed videos (with transcripts)
// ============================================================================

export async function GET() {
  // Query for all videos that have transcripts with their processing status
  // This uses a single optimized query instead of multiple separate queries
  const results = await getProcessedVideosWithStatus();

  // Transform to match the ProcessedVideosList expected format
  const processedVideos = results.map((row) => ({
    videoId: row.videoId,
    videoData: {
      title: row.title,
      description: row.description ?? "",
      duration: row.durationSeconds
        ? formatDuration(row.durationSeconds)
        : "N/A",
      thumbnail: row.thumbnail ?? "",
      channelName: row.channelName,
    },
    hasSlides: row.hasSlides,
    hasAnalysis: row.hasAnalysis,
    hasSuperAnalysis: row.hasSuperAnalysis,
    hasSlideAnalysis: row.hasSlideAnalysis,
    completedAt: row.createdAt?.toISOString(),
  }));

  return NextResponse.json(processedVideos);
}
