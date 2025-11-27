import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, scrapTranscriptV1, videos } from "@/db/schema";

// ============================================================================
// GET - Check video status and get basic info
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Invalid YouTube video ID format" },
      { status: 400 },
    );
  }

  // Query for video info and transcript
  const result = await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      channelName: channels.channelName,
      thumbnail: scrapTranscriptV1.thumbnail,
      transcript: scrapTranscriptV1.transcript,
    })
    .from(videos)
    .leftJoin(channels, eq(videos.channelId, channels.channelId))
    .leftJoin(scrapTranscriptV1, eq(videos.videoId, scrapTranscriptV1.videoId))
    .where(eq(videos.videoId, videoId))
    .limit(1);

  const row = result[0];

  // Video not found in database
  if (!row) {
    return NextResponse.json({
      status: "not_found",
      video: null,
    });
  }

  // Video exists but no transcript yet
  if (!row.transcript) {
    return NextResponse.json({
      status: "processing",
      video: {
        title: row.title,
        channelName: row.channelName,
        thumbnail: row.thumbnail,
      },
    });
  }

  // Video has transcript
  return NextResponse.json({
    status: "ready",
    video: {
      title: row.title,
      channelName: row.channelName,
      thumbnail: row.thumbnail,
    },
  });
}
