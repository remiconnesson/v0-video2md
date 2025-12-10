import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { 
  channels, 
  scrapTranscriptV1, 
  videos,
  videoAnalysisRuns,
  videoSlideExtractions
} from "@/db/schema";
import { formatDuration } from "@/lib/time-utils";

// ============================================================================
// GET - List all processed videos (with transcripts)
// ============================================================================

export async function GET() {
  // Query for all videos that have transcripts
  const results = await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      description: scrapTranscriptV1.description,
      durationSeconds: scrapTranscriptV1.durationSeconds,
      thumbnail: scrapTranscriptV1.thumbnail,
      createdAt: scrapTranscriptV1.createdAt,
      channelName: channels.channelName,
      viewCount: scrapTranscriptV1.viewCount,
      likeCount: scrapTranscriptV1.likeCount,
    })
    .from(videos)
    .innerJoin(scrapTranscriptV1, eq(videos.videoId, scrapTranscriptV1.videoId))
    .innerJoin(channels, eq(videos.channelId, channels.channelId))
    .where(isNotNull(scrapTranscriptV1.transcript))
    .orderBy(desc(scrapTranscriptV1.createdAt))
    .limit(50);

  // Get analysis and slides data for each video
  const videoIds = results.map(row => row.videoId);
  
  // Get latest analysis runs
  const analysisResults = await db
    .select({
      videoId: videoAnalysisRuns.videoId,
      status: videoAnalysisRuns.status,
      version: videoAnalysisRuns.version,
      createdAt: videoAnalysisRuns.createdAt,
    })
    .from(videoAnalysisRuns)
    .where(
      videoIds.length > 0 ? sql`${videoAnalysisRuns.videoId} IN ${videoIds}` : sql`false`
    )
    .orderBy(desc(videoAnalysisRuns.createdAt));

  // Get slides extraction data
  const slidesResults = await db
    .select({
      videoId: videoSlideExtractions.videoId,
      status: videoSlideExtractions.status,
      totalSlides: videoSlideExtractions.totalSlides,
    })
    .from(videoSlideExtractions)
    .where(
      videoIds.length > 0 ? sql`${videoSlideExtractions.videoId} IN ${videoIds}` : sql`false`
    );

  // Transform to match the enhanced format
  const processedVideos = results.map((row) => {
    // Get latest analysis for this video
    const latestAnalysis = analysisResults
      .filter(ar => ar.videoId === row.videoId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    // Get slides data for this video
    const slidesData = slidesResults.find(sr => sr.videoId === row.videoId);

    return {
      videoId: row.videoId,
      videoData: {
        title: row.title,
        description: row.description ?? "",
        duration: row.durationSeconds
          ? formatDuration(row.durationSeconds)
          : "N/A",
        thumbnail: row.thumbnail ?? "",
        channelName: row.channelName,
        viewCount: row.viewCount ?? 0,
        likeCount: row.likeCount ?? 0,
      },
      analysis: latestAnalysis ? {
        status: latestAnalysis.status,
        version: latestAnalysis.version,
        hasAnalysis: true,
      } : {
        status: "pending" as const,
        version: 0,
        hasAnalysis: false,
      },
      slides: slidesData ? {
        status: slidesData.status,
        totalSlides: slidesData.totalSlides || 0,
        hasSlides: (slidesData.totalSlides || 0) > 0,
      } : {
        status: "pending" as const,
        totalSlides: 0,
        hasSlides: false,
      },
      completedAt: row.createdAt?.toISOString(),
    };
  });

  return NextResponse.json(processedVideos);
}