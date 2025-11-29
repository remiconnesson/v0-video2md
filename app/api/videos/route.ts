import { desc, eq, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, scrapTranscriptV1, videos } from "@/db/schema";
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
    extractSlides: false,
    completedAt: row.createdAt?.toISOString(),
  }));

  return NextResponse.json(processedVideos);
}
