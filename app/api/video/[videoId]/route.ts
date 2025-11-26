import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  channels,
  scrapTranscriptV1,
  videoBookContent,
  videos,
} from "@/db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Query video with related data
  const result = await db
    .select({
      video: {
        videoId: videos.videoId,
        url: videos.url,
        title: videos.title,
        publishedAt: videos.publishedAt,
      },
      channel: {
        channelId: channels.channelId,
        channelName: channels.channelName,
      },
      transcript: {
        description: scrapTranscriptV1.description,
        thumbnail: scrapTranscriptV1.thumbnail,
        viewCount: scrapTranscriptV1.viewCount,
        likeCount: scrapTranscriptV1.likeCount,
        durationSeconds: scrapTranscriptV1.durationSeconds,
      },
      bookContent: {
        videoSummary: videoBookContent.videoSummary,
        chapters: videoBookContent.chapters,
      },
    })
    .from(videos)
    .leftJoin(channels, eq(videos.channelId, channels.channelId))
    .leftJoin(scrapTranscriptV1, eq(videos.videoId, scrapTranscriptV1.videoId))
    .leftJoin(videoBookContent, eq(videos.videoId, videoBookContent.videoId))
    .where(eq(videos.videoId, videoId))
    .limit(1);

  const row = result[0];

  // Video not found in database
  if (!row) {
    return NextResponse.json({ status: "not_found" as const, videoId });
  }

  // Video exists but book content not yet generated
  if (!row.bookContent?.videoSummary) {
    return NextResponse.json({
      status: "processing" as const,
      videoId,
      video: {
        ...row.video,
        channelName: row.channel?.channelName,
        description: row.transcript?.description,
        thumbnail: row.transcript?.thumbnail,
      },
    });
  }

  // Video and book content both exist - ready to use
  return NextResponse.json({
    status: "ready" as const,
    videoId,
    video: {
      ...row.video,
      channelName: row.channel?.channelName,
      description: row.transcript?.description,
      thumbnail: row.transcript?.thumbnail,
      viewCount: row.transcript?.viewCount,
      likeCount: row.transcript?.likeCount,
      durationSeconds: row.transcript?.durationSeconds,
    },
    bookContent: {
      videoSummary: row.bookContent.videoSummary,
      chapters: row.bookContent.chapters,
    },
  });
}
