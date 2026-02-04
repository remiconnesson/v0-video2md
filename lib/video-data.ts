import "server-only";

import type { VideoData } from "@/components/processed-videos-list";
import { getProcessedVideosWithStatus } from "@/db/queries";
import { formatDuration } from "@/lib/time-utils";

/**
 * Fetches processed videos with their status and transforms them into the VideoData format.
 * This function is shared between the API route and server components.
 */
export async function getProcessedVideosData(): Promise<VideoData[]> {
  const results = await getProcessedVideosWithStatus();

  return results.map((row) => ({
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
}
