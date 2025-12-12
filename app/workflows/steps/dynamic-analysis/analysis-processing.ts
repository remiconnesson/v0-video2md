import { desc, eq } from "drizzle-orm";
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
import { emitPartialResult, emitResult } from "./stream-emitters";

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
  const transcriptRow = (
    await db
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
      .limit(1)
  )[0];

  if (!transcriptRow) {
    throw new Error(`Transcript not found for video ID: ${videoId}`);
  }

  return transcriptRow;
}

export async function fetchTranscriptData(
  videoId: string,
): Promise<TranscriptData> {
  "use step";

  const transcriptRow = await getTranscriptRow(videoId);

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
  additionalInstructions?: string,
): Promise<number> {
  "use step";
  await emitResult(result);

  const [createdRun] = await db
    .insert(videoAnalysisRuns)
    .values({
      videoId,
      version,
      additionalInstructions: additionalInstructions ?? null,
      result,
    })
    .onConflictDoUpdate({
      target: [videoAnalysisRuns.videoId, videoAnalysisRuns.version],
      set: {
        additionalInstructions: additionalInstructions ?? null,
        result,
      },
    })
    .returning({ id: videoAnalysisRuns.id });
  return createdRun.id;
}

export async function doTranscriptAIAnalysis(
  transcriptData: TranscriptData,
  additionalInstructions?: string,
): Promise<Record<string, unknown>> {
  "use step";

  const analysisStream = streamDynamicAnalysis({
    title: transcriptData.title,
    channelName: transcriptData.channelName,
    description: transcriptData.description ?? undefined,
    transcript: transcriptData.transcript,
    additionalInstructions,
  });

  for await (const partialResult of analysisStream.partialObjectStream) {
    await emitPartialResult(partialResult);
  }

  const finalAnalysisResult = await analysisStream.object;

  return finalAnalysisResult as Record<string, unknown>;
}
