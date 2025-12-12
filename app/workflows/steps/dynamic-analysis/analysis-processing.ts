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
import { emitPartialResult } from "./stream-emitters";

// ============================================================================
// Transcript Schema (for validation)
// ============================================================================

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

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

export async function fetchTranscriptData(
  videoId: string,
): Promise<TranscriptData | null> {
  "use step";

  const dbQueryResult = await db
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

  const transcriptRow = dbQueryResult[0];
  if (!transcriptRow || !transcriptRow.transcript) {
    return null;
  }

  // Validate transcript structure
  const transcriptParseResult = z
    .array(TranscriptSegmentSchema)
    .safeParse(transcriptRow.transcript);

  if (!transcriptParseResult.success) {
    console.error("[DynamicAnalysis] Transcript validation failed:", videoId);
    return null;
  }

  return {
    videoId: transcriptRow.videoId,
    title: transcriptRow.title,
    channelName: transcriptRow.channelName,
    description: transcriptRow.description,
    transcript: formatTranscriptForLLM(transcriptParseResult.data),
  };
}

// ============================================================================
// Step: Get next version number for a video
// ============================================================================

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

// ============================================================================
// Step: Create analysis run (atomic version calculation + insert)
// ============================================================================

export async function createAnalysisRun(
  videoId: string,
  additionalInstructions?: string,
): Promise<number> {
  "use step";

  // Get next version
  const versionQueryResult = await db
    .select({ version: videoAnalysisRuns.version })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId))
    .orderBy(desc(videoAnalysisRuns.version))
    .limit(1);

  const nextVersion = (versionQueryResult[0]?.version ?? 0) + 1;

  // Insert the run with conflict resolution for idempotency during workflow replay
  const [createdRun] = await db
    .insert(videoAnalysisRuns)
    .values({
      videoId,
      version: nextVersion,
      additionalInstructions: additionalInstructions ?? null,
      status: "streaming",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [videoAnalysisRuns.videoId, videoAnalysisRuns.version],
      set: {
        additionalInstructions: additionalInstructions ?? null,
        status: "streaming",
        updatedAt: new Date(),
      },
    })
    .returning({ id: videoAnalysisRuns.id });

  return createdRun.id;
}

// ============================================================================
// Step: Run god prompt
// ============================================================================

export async function runGodPrompt(
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

  // Import emitResult dynamically to avoid circular dependency
  const { emitResult } = await import("./stream-emitters");
  await emitResult(finalAnalysisResult);
  return finalAnalysisResult as Record<string, unknown>;
}

// ============================================================================
// Step: Update run status to completed
// ============================================================================

export async function completeRun(
  dbRunId: number,
  result: Record<string, unknown>,
): Promise<void> {
  "use step";

  await db
    .update(videoAnalysisRuns)
    .set({
      result,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(videoAnalysisRuns.id, dbRunId));
}

// ============================================================================
// Step: Mark run as failed
// ============================================================================

export async function failRun(dbRunId: number): Promise<void> {
  "use step";

  await db
    .update(videoAnalysisRuns)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(videoAnalysisRuns.id, dbRunId));
}
