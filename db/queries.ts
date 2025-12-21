import { eq } from "drizzle-orm";
import { db } from "./index";
import { channels, scrapTranscriptV1, videos } from "./schema";

/**
 * Gets video data with transcript information by joining videos, channels, and scrapTranscriptV1 tables.
 * Returns null if no video with transcript is found.
 */
export async function getVideoWithTranscript(videoId: string) {
  const results = await db
    .select({
      videoId: videos.videoId,
      title: videos.title,
      channelName: channels.channelName,
      description: scrapTranscriptV1.description,
      transcript: scrapTranscriptV1.transcript,
    })
    .from(videos)
    .innerJoin(channels, eq(videos.channelId, channels.channelId))
    .innerJoin(scrapTranscriptV1, eq(videos.videoId, scrapTranscriptV1.videoId))
    .where(eq(videos.videoId, videoId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}
