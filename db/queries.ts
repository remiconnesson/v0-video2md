import { and, asc, desc, eq, inArray, isNotNull, type SQL } from "drizzle-orm";
import type { SlideData } from "@/lib/slides-types";
import type { TranscriptSegment } from "@/lib/transcript-format";
import { db } from "./index";
import {
  channels,
  type FramePosition,
  scrapTranscriptV1,
  slideAnalysisResults,
  slideFeedback,
  superAnalysisRuns,
  superAnalysisWorkflowIds,
  videoAnalysisRuns,
  videoAnalysisWorkflowIds,
  videoSlideExtractions,
  videoSlides,
  videos,
} from "./schema";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to consistently handle single-result queries that may return null.
 */
async function findOne<T>(query: Promise<T[]>): Promise<T | null> {
  const [result] = await query;
  return result ?? null;
}

/**
 * Type representing Drizzle tables that have a videoId column.
 * Used with selectVideoIdsFrom function.
 */
type TableWithVideoId =
  | typeof videoSlides
  | typeof videoAnalysisRuns
  | typeof superAnalysisRuns
  | typeof slideAnalysisResults;

/**
 * Builds a query to select video IDs from a table with optional conditions.
 * Handles empty array guard and provides consistent error handling.
 */
async function selectVideoIdsFrom(
  table: TableWithVideoId,
  videoIds: string[],
  options: {
    distinct?: boolean;
    additionalWhere?: SQL<unknown>;
    withErrorHandling?: boolean;
  } = {},
) {
  if (videoIds.length === 0) return [];

  const {
    distinct = false,
    additionalWhere,
    withErrorHandling = false,
  } = options;

  const baseQuery = distinct
    ? db.selectDistinct({ videoId: table.videoId })
    : db.select({ videoId: table.videoId });

  const whereConditions = [inArray(table.videoId, videoIds)];
  if (additionalWhere) {
    whereConditions.push(additionalWhere);
  }

  const query = baseQuery.from(table).where(and(...whereConditions));

  if (withErrorHandling) {
    try {
      return await query;
    } catch (error) {
      console.error(`Error querying ${table._.name} for video IDs:`, error);
      return [];
    }
  }

  return await query;
}

// ============================================================================
// Video Status and Basic Info Queries
// ============================================================================

/**
 * Gets video data with transcript information by joining videos, channels, and scrapTranscriptV1 tables.
 * Returns null if no video with transcript is found.
 */
export async function getVideoWithTranscript(videoId: string) {
  return await findOne(
    db
      .select({
        videoId: videos.videoId,
        title: videos.title,
        channelName: channels.channelName,
        description: scrapTranscriptV1.description,
        durationSeconds: scrapTranscriptV1.durationSeconds,
        transcript: scrapTranscriptV1.transcript,
      })
      .from(videos)
      .innerJoin(channels, eq(videos.channelId, channels.channelId))
      .innerJoin(
        scrapTranscriptV1,
        eq(videos.videoId, scrapTranscriptV1.videoId),
      )
      .where(eq(videos.videoId, videoId))
      .limit(1),
  );
}

/**
 * Gets basic video info with optional transcript and channel data.
 * Used for video status checking.
 */
export async function getVideoStatus(videoId: string) {
  return await findOne(
    db
      .select({
        videoId: videos.videoId,
        title: videos.title,
        channelName: channels.channelName,
        thumbnail: scrapTranscriptV1.thumbnail,
        transcript: scrapTranscriptV1.transcript,
      })
      .from(videos)
      .leftJoin(channels, eq(videos.channelId, channels.channelId))
      .leftJoin(
        scrapTranscriptV1,
        eq(videos.videoId, scrapTranscriptV1.videoId),
      )
      .where(eq(videos.videoId, videoId))
      .limit(1),
  );
}

// ============================================================================
// Videos List Queries
// ============================================================================

/**
 * Gets all processed videos (with transcripts) for the main videos list.
 */
export async function getProcessedVideos() {
  return await db
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
    .orderBy(desc(scrapTranscriptV1.createdAt));
}

/**
 * Gets video IDs that have slides.
 */
export async function getVideoIdsWithSlides(videoIds: string[]) {
  return await selectVideoIdsFrom(videoSlides, videoIds);
}

/**
 * Gets video IDs that have completed analysis.
 */
export async function getVideoIdsWithAnalysis(videoIds: string[]) {
  return await selectVideoIdsFrom(videoAnalysisRuns, videoIds, {
    additionalWhere: isNotNull(videoAnalysisRuns.result),
  });
}

/**
 * Checks if a video has any slide analysis results.
 */
export async function hasSlideAnalysisResults(videoId: string) {
  const result = await findOne(
    db
      .select({ id: slideAnalysisResults.id })
      .from(slideAnalysisResults)
      .where(eq(slideAnalysisResults.videoId, videoId))
      .limit(1),
  );

  return !!result;
}

/**
 * Gets video IDs that have completed super analysis.
 */
export async function getVideoIdsWithSuperAnalysis(videoIds: string[]) {
  return await selectVideoIdsFrom(superAnalysisRuns, videoIds, {
    additionalWhere: isNotNull(superAnalysisRuns.result),
    withErrorHandling: true,
  });
}

/**
 * Gets video IDs that have slide analysis results.
 */
export async function getVideoIdsWithSlideAnalysis(videoIds: string[]) {
  return await selectVideoIdsFrom(slideAnalysisResults, videoIds, {
    distinct: true,
  });
}

// ============================================================================
// Slide Extraction Queries
// ============================================================================

/**
 * Gets slide extraction status for a video.
 */
export async function getSlideExtractionStatus(videoId: string) {
  return await findOne(
    db
      .select()
      .from(videoSlideExtractions)
      .where(eq(videoSlideExtractions.videoId, videoId))
      .limit(1),
  );
}

/**
 * Gets all slides for a video.
 */
export async function getVideoSlides(videoId: string) {
  return await db
    .select({
      slideNumber: videoSlides.slideNumber,
      startTime: videoSlides.startTime,
      endTime: videoSlides.endTime,
      duration: videoSlides.duration,
      // First frame data
      firstFrameImageUrl: videoSlides.firstFrameImageUrl,
      firstFrameIsDuplicate: videoSlides.firstFrameIsDuplicate,
      firstFrameDuplicateOfSlideNumber:
        videoSlides.firstFrameDuplicateOfSlideNumber,
      firstFrameDuplicateOfFramePosition:
        videoSlides.firstFrameDuplicateOfFramePosition,
      // Last frame data
      lastFrameImageUrl: videoSlides.lastFrameImageUrl,
      lastFrameIsDuplicate: videoSlides.lastFrameIsDuplicate,
      lastFrameDuplicateOfSlideNumber:
        videoSlides.lastFrameDuplicateOfSlideNumber,
      lastFrameDuplicateOfFramePosition:
        videoSlides.lastFrameDuplicateOfFramePosition,
    })
    .from(videoSlides)
    .where(eq(videoSlides.videoId, videoId))
    .orderBy(asc(videoSlides.slideNumber));
}

/**
 * Updates slide extraction status.
 */
export async function updateSlideExtractionStatus(
  videoId: string,
  status: "completed" | "failed",
  totalSlides?: number,
  errorMessage?: string,
) {
  await db
    .update(videoSlideExtractions)
    .set({
      status,
      totalSlides: totalSlides ?? null,
      errorMessage: errorMessage ?? null,
    })
    .where(eq(videoSlideExtractions.videoId, videoId));
}

/**
 * Updates slide extraction runId.
 */
export async function updateSlideExtractionRunId(
  videoId: string,
  runId: string,
) {
  await db
    .update(videoSlideExtractions)
    .set({ runId })
    .where(eq(videoSlideExtractions.videoId, videoId));
}

/**
 * Creates or updates slide extraction record.
 */
export async function upsertSlideExtraction(
  videoId: string,
  status: "pending" | "in_progress" | "completed" | "failed" = "in_progress",
) {
  await db
    .insert(videoSlideExtractions)
    .values({
      videoId,
      status,
    })
    .onConflictDoUpdate({
      target: videoSlideExtractions.videoId,
      set: {
        status,
        errorMessage: null,
      },
    });
}

/**
 * Deletes all slides for a video.
 */
export async function deleteVideoSlides(videoId: string) {
  await db.delete(videoSlides).where(eq(videoSlides.videoId, videoId));
}

/**
 * Deletes slide extraction record.
 */
export async function deleteSlideExtraction(videoId: string) {
  await db
    .delete(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId));
}

/**
 * Inserts a slide into the database.
 */
export async function insertVideoSlide(videoId: string, slideData: SlideData) {
  await db
    .insert(videoSlides)
    .values({
      videoId,
      ...slideData,
    })
    .onConflictDoNothing();
}

// ============================================================================
// Analysis Queries
// ============================================================================

/**
 * Gets completed analysis for a video.
 */
export async function getCompletedAnalysis(videoId: string) {
  return await findOne(
    db
      .select({
        videoId: videoAnalysisRuns.videoId,
        result: videoAnalysisRuns.result,
        createdAt: videoAnalysisRuns.createdAt,
      })
      .from(videoAnalysisRuns)
      .where(eq(videoAnalysisRuns.videoId, videoId)),
  );
}

/**
 * Gets workflow record for a video.
 */
export async function getWorkflowRecord(videoId: string) {
  return await findOne(
    db
      .select()
      .from(videoAnalysisWorkflowIds)
      .where(eq(videoAnalysisWorkflowIds.videoId, videoId)),
  );
}

/**
 * Stores workflow ID for a video.
 */
export async function storeWorkflowId(videoId: string, workflowId: string) {
  await db
    .insert(videoAnalysisWorkflowIds)
    .values({
      videoId,
      workflowId,
    })
    .onConflictDoUpdate({
      target: [videoAnalysisWorkflowIds.videoId],
      set: {
        workflowId,
        createdAt: new Date(),
      },
    });
}

/**
 * Saves transcript AI analysis result.
 */
export async function saveTranscriptAnalysis(
  videoId: string,
  result: Record<string, unknown>,
) {
  await db
    .insert(videoAnalysisRuns)
    .values({
      videoId,
      result,
    })
    .onConflictDoUpdate({
      target: [videoAnalysisRuns.videoId],
      set: {
        result,
      },
    });
}

// ============================================================================
// Super Analysis Queries
// ============================================================================

/**
 * Gets completed super analysis for a video.
 */
export async function getCompletedSuperAnalysis(videoId: string) {
  try {
    return await findOne(
      db
        .select({
          videoId: superAnalysisRuns.videoId,
          result: superAnalysisRuns.result,
          createdAt: superAnalysisRuns.createdAt,
        })
        .from(superAnalysisRuns)
        .where(eq(superAnalysisRuns.videoId, videoId)),
    );
  } catch (error) {
    // If the table doesn't exist yet, we treat it as no analysis found
    // This prevents the workflow from crashing if migrations haven't been run
    console.error("Error querying super_analysis_runs:", error);
    return null;
  }
}

/**
 * Saves super analysis result.
 */
export async function saveSuperAnalysisResult(videoId: string, result: string) {
  await db
    .insert(superAnalysisRuns)
    .values({
      videoId,
      result,
    })
    .onConflictDoUpdate({
      target: [superAnalysisRuns.videoId],
      set: {
        result,
      },
    });
}

/**
 * Gets workflow record for super analysis.
 */
export async function getSuperAnalysisWorkflowId(videoId: string) {
  try {
    return await findOne(
      db
        .select()
        .from(superAnalysisWorkflowIds)
        .where(eq(superAnalysisWorkflowIds.videoId, videoId)),
    );
  } catch (error) {
    console.error("Error querying super_analysis_workflow_ids:", error);
    return null;
  }
}

/**
 * Stores workflow ID for super analysis.
 */
export async function storeSuperAnalysisWorkflowId(
  videoId: string,
  workflowId: string,
) {
  await db
    .insert(superAnalysisWorkflowIds)
    .values({
      videoId,
      workflowId,
    })
    .onConflictDoUpdate({
      target: [superAnalysisWorkflowIds.videoId],
      set: {
        workflowId,
        createdAt: new Date(),
      },
    });
}

// ============================================================================
// Feedback Queries
// ============================================================================

/**
 * Checks if a video exists.
 */
export async function videoExists(videoId: string) {
  const [video] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  return !!video;
}

/**
 * Gets all slide feedback for a video.
 */
export async function getSlideFeedback(videoId: string) {
  return await db
    .select()
    .from(slideFeedback)
    .where(eq(slideFeedback.videoId, videoId));
}

/**
 * Inserts or updates slide feedback.
 */
export async function upsertSlideFeedback(
  videoId: string,
  feedback: {
    slideNumber: number;
    firstFrameHasUsefulContent?: boolean | null;
    lastFrameHasUsefulContent?: boolean | null;
    framesSameness?: "same" | "different" | null;
    isFirstFramePicked?: boolean;
    isLastFramePicked?: boolean;
  },
) {
  await db
    .insert(slideFeedback)
    .values({
      videoId,
      ...feedback,
    })
    .onConflictDoUpdate({
      target: [slideFeedback.videoId, slideFeedback.slideNumber],
      set: {
        ...feedback,
      },
    });
}

// ============================================================================
// Transcript Saving Queries
// ============================================================================

/**
 * Saves transcript data to the database.
 */
export async function saveTranscriptToDb(data: {
  videoId: string;
  url: string;
  title: string;
  date: string;
  channelId: string;
  channelName: string;
  description: string;
  numberOfSubscribers: number;
  viewCount: number;
  likes: number;
  duration: string;
  isAutoGenerated: boolean;
  thumbnailUrl: string;
  transcript: TranscriptSegment[];
}) {
  await db
    .insert(channels)
    .values({
      channelId: data.channelId,
      channelName: data.channelName,
    })
    .onConflictDoUpdate({
      target: channels.channelId,
      set: { channelName: data.channelName },
    });

  await db
    .insert(videos)
    .values({
      videoId: data.videoId,
      url: data.url,
      title: data.title,
      publishedAt: data.date ? new Date(data.date) : null,
      channelId: data.channelId,
    })
    .onConflictDoUpdate({
      target: videos.videoId,
      set: {
        title: data.title,
        url: data.url,
      },
    });

  await db
    .insert(scrapTranscriptV1)
    .values({
      videoId: data.videoId,
      channelId: data.channelId,
      description: data.description,
      subscriberCount: data.numberOfSubscribers,
      viewCount: data.viewCount,
      likeCount: data.likes,
      durationSeconds: parseDuration(data.duration),
      isAutoGenerated: data.isAutoGenerated,
      thumbnail: data.thumbnailUrl,
      transcript: data.transcript,
    })
    .onConflictDoUpdate({
      target: scrapTranscriptV1.videoId,
      set: {
        channelId: data.channelId,
        description: data.description,
        subscriberCount: data.numberOfSubscribers,
        viewCount: data.viewCount,
        likeCount: data.likes,
        durationSeconds: parseDuration(data.duration),
        isAutoGenerated: data.isAutoGenerated,
        thumbnail: data.thumbnailUrl,
        transcript: data.transcript,
      },
    });
}

// Helper function for duration parsing (moved from save-transcript.ts)
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================================================
// Slide Analysis Queries
// ============================================================================

/**
 * Gets all slide analysis results for a video.
 */
export async function getSlideAnalysisResults(videoId: string) {
  return await db
    .select()
    .from(slideAnalysisResults)
    .where(eq(slideAnalysisResults.videoId, videoId))
    .orderBy(
      asc(slideAnalysisResults.slideNumber),
      asc(slideAnalysisResults.framePosition),
    );
}

/**
 * Saves or updates a slide analysis result.
 */
export async function saveSlideAnalysisResult(
  videoId: string,
  slideNumber: number,
  framePosition: FramePosition,
  markdownContent: string,
) {
  await db
    .insert(slideAnalysisResults)
    .values({
      videoId,
      slideNumber,
      framePosition,
      markdownContent,
    })
    .onConflictDoUpdate({
      target: [
        slideAnalysisResults.videoId,
        slideAnalysisResults.slideNumber,
        slideAnalysisResults.framePosition,
      ],
      set: {
        markdownContent,
        createdAt: new Date(),
      },
    });
}

/**
 * Deletes all slide analysis results for a video.
 */
export async function deleteSlideAnalysisResults(videoId: string) {
  await db
    .delete(slideAnalysisResults)
    .where(eq(slideAnalysisResults.videoId, videoId));
}
