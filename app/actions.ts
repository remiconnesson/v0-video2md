"use server";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { videoAnalysisWorkflowIds } from "@/db/schema";
import {
  extractYoutubeVideoId,
  isValidYouTubeVideoId,
  type YouTubeVideoId,
} from "@/lib/youtube-utils";

const videoIdSchema = z.object({
  videoId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube Video ID"),
});

export async function validateVideoId(_prevState: unknown, formData: FormData) {
  const input = (formData.get("videoId") as string | null) || "";

  // Extract video ID from URL if a full URL was provided
  const videoId = extractYoutubeVideoId(input) || input;

  const parsed = videoIdSchema.safeParse({ videoId });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid YouTube Video ID",
    };
  }

  return {
    success: true,
    videoId: parsed.data.videoId,
  };
}

// TODO: this below should be in another file, but where?

type GetAnalysisVersionsResult =
  | {
      success: true;
      versions: number[];
    }
  | {
      success: false;
      error: string;
    };

export async function getAnalysisVersions(
  videoId: string,
): Promise<GetAnalysisVersionsResult> {
  // Validate YouTube video ID
  if (!isValidYouTubeVideoId(videoId)) {
    return {
      success: false,
      error: "Invalid YouTube video ID format",
    };
  }

  const versions = await getAnalysisVersionsForVideo(videoId);

  return {
    success: true,
    versions: versions.map((version) => version.version),
  };
}

export async function getAnalysisVersionsForVideo(videoId: YouTubeVideoId) {
  // Get all versions for the video
  const versions = await db
    .select({
      version: videoAnalysisWorkflowIds.version,
    })
    .from(videoAnalysisWorkflowIds)
    .where(eq(videoAnalysisWorkflowIds.videoId, videoId))
    .orderBy(desc(videoAnalysisWorkflowIds.version));
  return versions;
}
