import { desc, eq } from "drizzle-orm";
import { getWritable } from "workflow";
import { z } from "zod";
import { streamDynamicAnalysis } from "@/ai/dynamic-analysis";
import { db } from "@/db";
import {
  channels,
  scrapTranscriptV1,
  videoAnalysisRuns,
  videos,
} from "@/db/schema";
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

// TODO: should be in the API not the workflow
export async function getNextVersion(videoId: string): Promise<number> {
  "use step";

  const versionQueryResult = await db
    .select({ version: videoAnalysisRuns.version })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId))
    .orderBy(desc(videoAnalysisRuns.version))
    .limit(1);

  const maxVersion = versionQueryResult[0]?.version ?? 0;

  return maxVersion + 1;
}

export async function saveTranscriptAIAnalysisToDb(
  videoId: string,
  result: Record<string, unknown>,
  version: number,
) {
  "use step";

  await emitResult(result);

  await db
    .insert(videoAnalysisRuns)
    .values({
      videoId,
      version,
      result,
    })
    .onConflictDoUpdate({
      target: [videoAnalysisRuns.videoId, videoAnalysisRuns.version],
      set: {
        result,
      },
    });
}

export async function doTranscriptAIAnalysis(
  transcriptData: TranscriptData,
): Promise<Record<string, unknown>> {
  "use step";

  const analysisStream = streamDynamicAnalysis({
    title: transcriptData.title,
    channelName: transcriptData.channelName,
    description: transcriptData.description ?? undefined,
    transcript: transcriptData.transcript,
  });

  for await (const partialResult of analysisStream.partialObjectStream) {
    await emitPartialResult(partialResult);
  }

  const finalAnalysisResult = await analysisStream.object;

  return finalAnalysisResult as Record<string, unknown>;
}

// ============================================================================
// Stream Event Types
// ============================================================================

export type AnalysisStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "partial"; data: unknown }
  | { type: "result"; data: unknown }
  | { type: "complete"; runId: number }
  | { type: "error"; message: string };

// ============================================================================
// Step: Emit progress
// ============================================================================

export async function emitProgress(phase: string, message: string) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", phase, message });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit result
// ============================================================================

export async function emitResult(data: unknown) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "result", data });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit partial result
// ============================================================================

export async function emitPartialResult(data: unknown) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "partial", data });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit completion
// ============================================================================

export async function emitComplete(runId: number) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", runId });
  writer.releaseLock();
  await writable.close();
}

// ============================================================================
// Step: Emit error
// ============================================================================

export async function emitError(message: string) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", message });
  writer.releaseLock();
  await writable.close();
}
