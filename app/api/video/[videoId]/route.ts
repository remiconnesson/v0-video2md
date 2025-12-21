import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { channels, scrapTranscriptV1, videos } from "@/db/schema";
import {
  type VideoStatusResponse,
  videoStatusResponseSchema,
} from "@/lib/api-types";
import {
  errorResponse,
  logError,
  validateYouTubeVideoId,
} from "@/lib/api-utils";

// ============================================================================
// GET - Check video status and get basic info
// ============================================================================

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/video/[videoId]">,
) {
  const { videoId } = await ctx.params;

  // Validate videoId format
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

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

  let responseData: VideoStatusResponse;

  // Video not found in database
  if (!row) {
    responseData = {
      status: "not_found",
      video: null,
    };
  } else if (!row.transcript) {
    // Video exists but no transcript yet
    responseData = {
      status: "processing",
      video: {
        title: row.title,
        channelName: row.channelName,
        thumbnail: row.thumbnail,
      },
    };
  } else {
    // Video has transcript
    responseData = {
      status: "ready",
      video: {
        title: row.title,
        channelName: row.channelName,
        thumbnail: row.thumbnail,
      },
    };
  }

  const validationResult = videoStatusResponseSchema.safeParse(responseData);

  if (!validationResult.success) {
    logError(validationResult.error, "Invalid response data", { videoId });
    return errorResponse("Invalid response data", 500);
  }

  return NextResponse.json(validationResult.data);
}
