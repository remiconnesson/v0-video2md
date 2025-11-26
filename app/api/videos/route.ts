import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  channels,
  scrapTranscriptV1,
  videoBookContent,
  videos,
} from "@/db/schema";

export async function GET() {
  try {
    // Query all videos that have been processed (have videoBookContent)
    const result = await db
      .select({
        videoId: videos.videoId,
        title: videos.title,
        url: videos.url,
        publishedAt: videos.publishedAt,
        channelName: channels.channelName,
        description: scrapTranscriptV1.description,
        thumbnail: scrapTranscriptV1.thumbnail,
        durationSeconds: scrapTranscriptV1.durationSeconds,
        createdAt: videoBookContent.createdAt,
      })
      .from(videos)
      .innerJoin(videoBookContent, eq(videos.videoId, videoBookContent.videoId))
      .leftJoin(channels, eq(videos.channelId, channels.channelId))
      .leftJoin(
        scrapTranscriptV1,
        eq(videos.videoId, scrapTranscriptV1.videoId),
      )
      .orderBy(desc(videoBookContent.createdAt));

    // Format the response to match the expected VideoData interface
    const formattedVideos = result.map((row) => ({
      videoId: row.videoId,
      videoData: {
        title: row.title,
        description: row.description || "",
        duration: formatDuration(row.durationSeconds),
        thumbnail: row.thumbnail || "",
      },
      extractSlides: false, // We don't have this info in the schema yet
      completedAt: row.createdAt?.toISOString(),
    }));

    return NextResponse.json(formattedVideos);
  } catch (error) {
    console.error("Error fetching processed videos:", error);
    return NextResponse.json(
      { error: "Failed to fetch processed videos" },
      { status: 500 },
    );
  }
}

// Helper function to format duration from seconds to human-readable format
function formatDuration(seconds: number | null): string {
  if (!seconds) return "N/A";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
