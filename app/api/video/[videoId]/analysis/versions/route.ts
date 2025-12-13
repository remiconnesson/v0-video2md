import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { videoAnalysisRuns, videoAnalysisWorkflowIds } from "@/db/schema";
import {
  isValidYouTubeVideoId,
  type YouTubeVideoId,
} from "@/lib/youtube-utils";

type GetAnalysisVersionsResult =
  | {
      success: true;
      versions: { version: string }[];
    }
  | {
      success: false;
      error: string;
    };

async function getAnalysisVersionsForVideo(videoId: YouTubeVideoId) {
  // Get all versions for the video
  const versions = await db
    .select({
      version: videoAnalysisRuns.version,
    })
    .from(videoAnalysisWorkflowIds)
    .where(eq(videoAnalysisWorkflowIds.videoId, videoId))
    .orderBy(desc(videoAnalysisWorkflowIds.version));
  return versions;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate YouTube video ID
  if (!isValidYouTubeVideoId(videoId)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid YouTube video ID format",
      } satisfies GetAnalysisVersionsResult,
      { status: 400 },
    );
  }

  try {
    const versions = await getAnalysisVersionsForVideo(videoId);

    return NextResponse.json({
      success: true,
      versions,
    } satisfies GetAnalysisVersionsResult);
  } catch (error) {
    console.error("Error fetching analysis versions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analysis versions",
      } satisfies GetAnalysisVersionsResult,
      { status: 500 },
    );
  }
}
