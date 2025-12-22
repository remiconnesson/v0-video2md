import { NextResponse } from "next/server";
import {
  getProcessedVideos,
  getVideoIdsWithAnalysis,
  getVideoIdsWithSlideAnalysis,
  getVideoIdsWithSlides,
  getVideoIdsWithSuperAnalysis,
} from "@/db/queries";
import { formatDuration } from "@/lib/time-utils";

// ============================================================================
// GET - List all processed videos (with transcripts)
// ============================================================================

export async function GET() {
  // Query for all videos that have transcripts
  const results = await getProcessedVideos();
  const videoIds = results.map((row) => row.videoId);

  const [slidesRows, analysisRows, slideAnalysisRows, superAnalysisRows] = await Promise.all([
    getVideoIdsWithSlides(videoIds),
    getVideoIdsWithAnalysis(videoIds),
    getVideoIdsWithSlideAnalysis(videoIds),
    getVideoIdsWithSuperAnalysis(videoIds),
  ]);

  const videosWithSlides = new Set(slidesRows.map((row) => row.videoId));
  const videosWithAnalysis = new Set(analysisRows.map((row) => row.videoId));
  const videosWithSuperAnalysis = new Set(
    superAnalysisRows.map((row) => row.videoId),
   );
  const videosWithSlideAnalysis = new Set(
    slideAnalysisRows.map((row) => row.videoId),
  );

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
    hasSlides: videosWithSlides.has(row.videoId),
    hasAnalysis: videosWithAnalysis.has(row.videoId),
    hasSuperAnalysis: videosWithSuperAnalysis.has(row.videoId),
    hasSlideAnalysis: videosWithSlideAnalysis.has(row.videoId),
    completedAt: row.createdAt?.toISOString(),
  }));

  return NextResponse.json(processedVideos);
}
