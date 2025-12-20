import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videoSlideExtractions } from "@/db/schema";
import type { YouTubeVideoId } from "@/lib/youtube-utils";

// ============================================================================
// Status Helper
// ============================================================================

export async function updateExtractionStatus(
  videoId: YouTubeVideoId,
  status: "completed" | "failed",
  totalSlides?: number,
  errorMessage?: string,
) {
  "use step";

  try {
    console.log(
      `📊 updateExtractionStatus: Updating extraction status for video ${videoId}:`,
      {
        status,
        totalSlides,
        hasErrorMessage: !!errorMessage,
      },
    );

    await db
      .update(videoSlideExtractions)
      .set({
        status,
        totalSlides: totalSlides ?? null,
        errorMessage: errorMessage ?? null,
      })
      .where(eq(videoSlideExtractions.videoId, videoId));

    console.log(
      `📊 updateExtractionStatus: Successfully updated extraction status for video ${videoId}`,
    );
    return;
  } catch (error) {
    console.error(
      `📊 updateExtractionStatus: Failed to update extraction status for video ${videoId}:`,
      {
        videoId,
        status,
        totalSlides,
        errorMessage,
        dbError:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      },
    );

    // Don't throw here - we don't want status update failures to crash the workflow
    // But log it prominently since this is critical for monitoring
    console.error(
      `📊 updateExtractionStatus: CRITICAL: Could not update extraction status for video ${videoId} - manual intervention may be required`,
    );
  }
}
