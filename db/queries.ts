import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { SlideData } from "@/lib/slides-types";
import type { TranscriptSegment } from "@/lib/transcript-format";
import { db } from "./index";
import {
  channels,
  type FramePosition,
  scrapTranscriptV1,
  slideAnalysisResults,
  slideFeedback,
  videoAnalysisRuns,
  videoAnalysisWorkflowIds,
  videoSlideExtractions,
  videoSlides,
  videos,
} from "./schema";

// ============================================================================
// Helper Functions
// ============================================================================

const slideFeedbackFieldOrder = [
  "firstFrameHasUsefulContent",
  "lastFrameHasUsefulContent",
  "framesSameness",
  "isFirstFramePicked",
  "isLastFramePicked",
] as const;

type SlideFeedbackField = (typeof slideFeedbackFieldOrder)[number];

type SlideFeedbackPayload = {
  firstFrameHasUsefulContent?: boolean | null;
  lastFrameHasUsefulContent?: boolean | null;
  framesSameness?: "same" | "different" | null;
  isFirstFramePicked?: boolean;
  isLastFramePicked?: boolean;
};

type SlideFeedbackFieldValueMap = Partial<
  Record<SlideFeedbackField, SlideFeedbackPayload[SlideFeedbackField]>
>;

const slideFeedbackFieldColumns: Record<SlideFeedbackField, string> = {
  firstFrameHasUsefulContent: "first_frame_has_useful_content",
  lastFrameHasUsefulContent: "last_frame_has_useful_content",
  framesSameness: "frames_sameness",
  isFirstFramePicked: "is_first_frame_picked",
  isLastFramePicked: "is_last_frame_picked",
};

const hasOwn = <T extends object>(obj: T, key: PropertyKey) =>
  Object.hasOwn(obj, key);

let slideFeedbackColumnsPromise: Promise<Set<string>> | null = null;

async function getSlideFeedbackColumns() {
  if (!slideFeedbackColumnsPromise) {
    slideFeedbackColumnsPromise = db
      .execute<{
        column_name: string;
      }>(
        sql`select column_name from information_schema.columns where table_name = 'slide_feedback' and table_schema = 'public'`,
      )
      .then((result) => new Set(result.rows.map((row) => row.column_name)));
  }

  return slideFeedbackColumnsPromise;
}

function getSupportedFeedbackFields(columns: Set<string>) {
  return slideFeedbackFieldOrder.filter((field) =>
    columns.has(slideFeedbackFieldColumns[field]),
  );
}

function pickSupportedFeedbackFields(
  feedback: SlideFeedbackPayload,
  columns: Set<string>,
) {
  return slideFeedbackFieldOrder.reduce<SlideFeedbackFieldValueMap>(
    (acc, field) => {
      const column = slideFeedbackFieldColumns[field];
      if (columns.has(column) && hasOwn(feedback, field)) {
        acc[field] = feedback[field];
      }
      return acc;
    },
    {},
  );
}

function buildInsertColumns(fields: string[]) {
  return [
    sql.identifier("video_id"),
    sql.identifier("slide_index"),
    ...fields.map((field) => sql.identifier(field)),
  ];
}

function buildValuesRow(
  videoId: string,
  slideNumber: number,
  fields: string[],
  fieldValues: Record<string, unknown>,
) {
  return sql`(${sql.join(
    [
      sql`${videoId}`,
      sql`${slideNumber}`,
      ...fields.map((field) => sql`${fieldValues[field]}`),
    ],
    sql`, `,
  )})`;
}

/**
 * Helper to consistently handle single-result queries that may return null.
 */
async function findOne<T>(query: Promise<T[]>): Promise<T | null> {
  const [result] = await query;
  return result ?? null;
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
  if (videoIds.length === 0) return [];
  return await db
    .select({ videoId: videoSlides.videoId })
    .from(videoSlides)
    .where(inArray(videoSlides.videoId, videoIds));
}

/**
 * Gets video IDs that have completed analysis.
 */
export async function getVideoIdsWithAnalysis(videoIds: string[]) {
  if (videoIds.length === 0) return [];
  return await db
    .select({ videoId: videoAnalysisRuns.videoId })
    .from(videoAnalysisRuns)
    .where(
      and(
        inArray(videoAnalysisRuns.videoId, videoIds),
        isNotNull(videoAnalysisRuns.result),
      ),
    );
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
  const columns = await getSlideFeedbackColumns();
  const optionalFieldSelections = slideFeedbackFieldOrder.map((field) => {
    const column = slideFeedbackFieldColumns[field];
    if (columns.has(column)) {
      return sql`${sql.identifier(column)} as "${sql.raw(field)}"`;
    }
    return sql`null as "${sql.raw(field)}"`;
  });

  const result = await db.execute(
    sql`select slide_index as "slideNumber", ${sql.join(
      optionalFieldSelections,
      sql`, `,
    )} from slide_feedback where video_id = ${videoId}`,
  );

  return result.rows;
}

/**
 * Inserts or updates slide feedback.
 */
export async function upsertSlideFeedback(
  videoId: string,
  feedback: { slideNumber: number } & SlideFeedbackPayload,
) {
  const columns = await getSlideFeedbackColumns();
  const supportedFields = pickSupportedFeedbackFields(feedback, columns);
  const insertFields = slideFeedbackFieldOrder
    .filter((field) => hasOwn(supportedFields, field))
    .map((field) => slideFeedbackFieldColumns[field]);

  const updateSet = slideFeedbackFieldOrder.reduce<Record<string, unknown>>(
    (acc, field) => {
      if (hasOwn(supportedFields, field)) {
        acc[slideFeedbackFieldColumns[field]] =
          supportedFields[field as SlideFeedbackField];
      }
      return acc;
    },
    {},
  );

  if (Object.keys(updateSet).length === 0) {
    if (insertFields.length === 0) {
      await db.execute(
        sql`insert into slide_feedback (video_id, slide_index) values (${videoId}, ${feedback.slideNumber}) on conflict (video_id, slide_index) do nothing`,
      );
      return;
    }

    await db.execute(
      sql`insert into slide_feedback (${sql.join(
        buildInsertColumns(insertFields),
        sql`, `,
      )}) values ${buildValuesRow(
        videoId,
        feedback.slideNumber,
        insertFields,
        updateSet,
      )} on conflict (video_id, slide_index) do nothing`,
    );
    return;
  }

  await db.execute(
    sql`insert into slide_feedback (${sql.join(
      buildInsertColumns(insertFields),
      sql`, `,
    )}) values ${buildValuesRow(
      videoId,
      feedback.slideNumber,
      insertFields,
      updateSet,
    )} on conflict (video_id, slide_index) do update set ${sql.join(
      Object.entries(updateSet).map(
        ([column]) =>
          sql`${sql.identifier(column)} = excluded.${sql.identifier(column)}`,
      ),
      sql`, `,
    )}`,
  );
}

/**
 * Inserts or updates multiple slide feedback entries.
 */
export async function upsertSlideFeedbackBatch(
  videoId: string,
  feedbackItems: Array<{ slideNumber: number } & SlideFeedbackPayload>,
) {
  if (feedbackItems.length === 0) return;

  const columns = await getSlideFeedbackColumns();
  const supportedFields = getSupportedFeedbackFields(columns);

  const groupedFeedback = feedbackItems.reduce((acc, feedback) => {
    const signature = supportedFields
      .map((field) => (hasOwn(feedback, field) ? "1" : "0"))
      .join("");
    const group = acc.get(signature) ?? [];
    group.push(feedback);
    acc.set(signature, group);
    return acc;
  }, new Map<string, typeof feedbackItems>());

  for (const [signature, items] of groupedFeedback) {
    const presentFields = supportedFields.filter(
      (_field, index) => signature[index] === "1",
    );
    const presentColumns = presentFields.map(
      (field) => slideFeedbackFieldColumns[field],
    );

    const insertValuesRows = items.map((feedback) => {
      const valuesByColumn = presentFields.reduce<Record<string, unknown>>(
        (acc, field) => {
          acc[slideFeedbackFieldColumns[field]] = feedback[field];
          return acc;
        },
        {},
      );

      return buildValuesRow(
        videoId,
        feedback.slideNumber,
        presentColumns,
        valuesByColumn,
      );
    });

    if (presentColumns.length === 0) {
      await db.execute(
        sql`insert into slide_feedback (video_id, slide_index) values ${sql.join(
          items.map((feedback) =>
            buildValuesRow(videoId, feedback.slideNumber, [], {}),
          ),
          sql`, `,
        )} on conflict (video_id, slide_index) do nothing`,
      );
      continue;
    }

    const updateAssignments = presentColumns.map(
      (column) =>
        sql`${sql.identifier(column)} = excluded.${sql.identifier(column)}`,
    );

    await db.execute(
      sql`insert into slide_feedback (${sql.join(
        buildInsertColumns(presentColumns),
        sql`, `,
      )}) values ${sql.join(
        insertValuesRows,
        sql`, `,
      )} on conflict (video_id, slide_index) do update set ${sql.join(
        updateAssignments,
        sql`, `,
      )}`,
    );
  }
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
