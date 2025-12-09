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

// ============================================================================
// Transcript Schema (for validation)
// ============================================================================

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

// ============================================================================
// Helper: Format transcript for LLM
// ============================================================================

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTranscriptForLLM(
  segments: Array<{ start: number; text: string }>,
): string {
  return segments
    .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join("\n");
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

export async function fetchTranscriptData(
  videoId: string,
): Promise<TranscriptData | null> {
  "use step";

  const result = await db
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

  const row = result[0];
  if (!row || !row.transcript) {
    return null;
  }

  // Validate transcript structure
  const transcriptParseResult = z
    .array(TranscriptSegmentSchema)
    .safeParse(row.transcript);

  if (!transcriptParseResult.success) {
    console.error("[DynamicAnalysis] Transcript validation failed:", videoId);
    return null;
  }

  return {
    videoId: row.videoId,
    title: row.title,
    channelName: row.channelName,
    description: row.description,
    transcript: formatTranscriptForLLM(transcriptParseResult.data),
  };
}

// ============================================================================
// Step: Get next version number for a video
// ============================================================================

export async function getNextVersion(videoId: string): Promise<number> {
  "use step";

  const result = await db
    .select({ version: videoAnalysisRuns.version })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId))
    .orderBy(desc(videoAnalysisRuns.version))
    .limit(1);

  const maxVersion = result[0]?.version ?? 0;
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
  const versionResult = await db
    .select({ version: videoAnalysisRuns.version })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId))
    .orderBy(desc(videoAnalysisRuns.version))
    .limit(1);

  const nextVersion = (versionResult[0]?.version ?? 0) + 1;

  // Insert the run
  const [createdRun] = await db
    .insert(videoAnalysisRuns)
    .values({
      videoId,
      version: nextVersion,
      additionalInstructions: additionalInstructions ?? null,
      status: "streaming",
      updatedAt: new Date(),
    })
    .returning({ id: videoAnalysisRuns.id });

  return createdRun.id;
}

// ============================================================================
// Step: Run god prompt
// ============================================================================

export async function runGodPrompt(
  data: TranscriptData,
  additionalInstructions?: string,
): Promise<Record<string, unknown>> {
  "use step";

  const stream = streamDynamicAnalysis({
    title: data.title,
    channelName: data.channelName,
    description: data.description ?? undefined,
    transcript: data.transcript,
    additionalInstructions,
  });

  for await (const partial of stream.partialObjectStream) {
    // Import emitPartialResult dynamically to avoid circular dependency
    const { emitPartialResult } = await import("./stream-emitters");
    await emitPartialResult(partial);
  }

  const result = await stream.object;

  // Import emitResult dynamically to avoid circular dependency
  const { emitResult } = await import("./stream-emitters");
  await emitResult(result);
  return result as Record<string, unknown>;
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
