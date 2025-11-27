import { desc, eq } from "drizzle-orm";
import { getWritable } from "workflow";
import { z } from "zod";
import { streamDynamicAnalysis } from "@/ai/dynamic-analysis";
import type { GodPromptResult } from "@/ai/dynamic-analysis-prompt";
import { db } from "@/db";
import {
  channels,
  scrapTranscriptV1,
  videoAnalysisRuns,
  videos,
} from "@/db/schema";

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
// Step: Emit progress
// ============================================================================

async function emitProgress(phase: string, message: string) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", phase, message });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit result
// ============================================================================

async function emitResult(data: unknown) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "result", data });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit partial result
// ============================================================================

async function emitPartialResult(data: unknown) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "partial", data });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit completion
// ============================================================================

async function emitComplete(runId: number) {
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

async function emitError(message: string) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", message });
  writer.releaseLock();
  await writable.close();
}

// ============================================================================
// Step: Fetch transcript data from DB
// ============================================================================

interface TranscriptData {
  videoId: string;
  title: string;
  channelName: string;
  description: string | null;
  transcript: string;
}

async function fetchTranscriptData(
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

async function getNextVersion(videoId: string): Promise<number> {
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
// Step: Run god prompt
// ============================================================================

async function runGodPrompt(
  data: TranscriptData,
  additionalInstructions?: string,
): Promise<GodPromptResult> {
  "use step";

  const stream = streamDynamicAnalysis({
    title: data.title,
    channelName: data.channelName,
    description: data.description ?? undefined,
    transcript: data.transcript,
    additionalInstructions,
  });

  for await (const partial of stream.partialObjectStream) {
    await emitPartialResult(partial);
  }

  const result = (await stream.object) as unknown as GodPromptResult;

  await emitResult(result);
  return result;
}

// ============================================================================
// Step: Persist run to database
// ============================================================================

async function persistRun(
  videoId: string,
  version: number,
  result: GodPromptResult,
  additionalInstructions?: string,
): Promise<number> {
  "use step";

  const [inserted] = await db
    .insert(videoAnalysisRuns)
    .values({
      videoId,
      version,
      result,
      additionalInstructions: additionalInstructions ?? null,
      status: "completed",
      updatedAt: new Date(),
    })
    .returning({ id: videoAnalysisRuns.id });

  return inserted.id;
}

// ============================================================================
// Main Workflow
// ============================================================================

export async function dynamicAnalysisWorkflow(
  videoId: string,
  additionalInstructions?: string,
) {
  "use workflow";

  // Step 1: Fetch transcript
  await emitProgress("fetching", "Fetching transcript from database...");
  const transcriptData = await fetchTranscriptData(videoId);

  if (!transcriptData) {
    await emitError(`No transcript found for video: ${videoId}`);
    throw new Error(`No transcript found for video: ${videoId}`);
  }

  // Step 2: Get next version
  const version = await getNextVersion(videoId);

  // Step 3: Run god prompt
  await emitProgress(
    "analyzing",
    "Analyzing transcript and generating extraction schema...",
  );
  const result = await runGodPrompt(transcriptData, additionalInstructions);

  // Step 5: Persist to DB
  await emitProgress("saving", "Saving analysis to database...");
  const runId = await persistRun(
    videoId,
    version,
    result,
    additionalInstructions,
  );

  // Step 6: Signal completion
  await emitComplete(runId);

  return {
    success: true,
    runId,
    version,
  };
}
