import { eq } from "drizzle-orm";
import { z } from "zod";
import { streamDynamicAnalysis } from "@/ai/dynamic-analysis";
import { db } from "@/db";
import {
  channels,
  scrapTranscriptV1,
  videoAnalysisRuns,
  videoAnalysisWorkflowIds,
  videos,
} from "@/db/schema";
import { emit } from "@/lib/stream-utils";
import { formatTranscriptForLLM } from "@/lib/transcript-format";

// ============================================================================
// Transcript Schema (for validation)
// ============================================================================

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});
type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
function validateTranscriptStructure(data: unknown): TranscriptSegment[] {
  return z.array(TranscriptSegmentSchema).parse(data);
}

// ============================================================================
// Transcript Data Interface
// ============================================================================

export interface TranscriptData {
  videoId: string;
  title: string;
  channelName: string;
  description: string | null;
  transcript: string;
}

// ============================================================================
// Step: Fetch transcript data from DB
// ============================================================================

async function getTranscriptRow(videoId: string) {
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

  if (results.length === 0) {
    return null;
  }

  return results[0];
}

export async function getTranscriptDataFromDb(
  videoId: string,
): Promise<TranscriptData | null> {
  "use step";

  const transcriptRow = await getTranscriptRow(videoId);

  if (!transcriptRow) {
    return null;
  }

  const transcriptSegments = validateTranscriptStructure(
    transcriptRow.transcript,
  );

  return {
    ...transcriptRow,
    transcript: formatTranscriptForLLM(transcriptSegments),
  };
}

export async function saveTranscriptAIAnalysisToDb(
  videoId: string,
  result: Record<string, unknown>,
  writable: WritableStream<AnalysisStreamEvent>,
) {
  "use step";

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

  // Clean up workflow ID after successful analysis save
  await db
    .delete(videoAnalysisWorkflowIds)
    .where(eq(videoAnalysisWorkflowIds.videoId, videoId));

  await emit<AnalysisStreamEvent>(
    { type: "result", data: result },
    writable,
    true,
  );
}

export async function doTranscriptAIAnalysis(
  transcriptData: TranscriptData,
  writable: WritableStream<AnalysisStreamEvent>,
) {
  "use step";

  const analysisStream = streamDynamicAnalysis({
    title: transcriptData.title,
    channelName: transcriptData.channelName,
    description: transcriptData.description ?? undefined,
    transcript: transcriptData.transcript,
  });

  for await (const partialResult of analysisStream.partialObjectStream) {
    await emit<AnalysisStreamEvent>(
      { type: "partial", data: partialResult },
      writable,
    );
  }

  const finalAnalysisResult = await analysisStream.object;

  return finalAnalysisResult as Record<string, unknown>;
}

export type AnalysisStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "partial"; data: unknown }
  | { type: "result"; data: unknown }
  | { type: "complete"; runId: number }
  | { type: "error"; message: string };
