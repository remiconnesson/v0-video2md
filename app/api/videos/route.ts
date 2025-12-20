import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  channels,
  scrapTranscriptV1,
  videoAnalysisRuns,
  videoSlides,
  videos,
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
    })
    .from(videos)
    .innerJoin(scrapTranscriptV1, eq(videos.videoId, scrapTranscriptV1.videoId))
    .innerJoin(channels, eq(videos.channelId, channels.channelId))
    .where(isNotNull(scrapTranscriptV1.transcript))
    .orderBy(desc(scrapTranscriptV1.createdAt))
    .limit(50);

  const videoIds = results.map((row) => row.videoId);

  const [slidesRows, analysisRows] = await Promise.all([
    videoIds.length
      ? db
          .select({ videoId: videoSlides.videoId })
          .from(videoSlides)
          .where(inArray(videoSlides.videoId, videoIds))
      : Promise.resolve([]),
    videoIds.length
      ? db
          .select({ videoId: videoAnalysisRuns.videoId })
          .from(videoAnalysisRuns)
          .where(
            and(
              inArray(videoAnalysisRuns.videoId, videoIds),
              isNotNull(videoAnalysisRuns.result),
            ),
          )
      : Promise.resolve([]),
  ]);

  const videosWithSlides = new Set(slidesRows.map((row) => row.videoId));
  const videosWithAnalysis = new Set(analysisRows.map((row) => row.videoId));

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
    completedAt: row.createdAt?.toISOString(),
  }));

  return NextResponse.json(processedVideos);
}
