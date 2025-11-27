import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDerivedAnalysis } from "@/ai/dynamic-analysis";
import { db } from "@/db";
import {
  channels,
  derivedAnalysisRuns,
  scrapTranscriptV1,
  videoAnalysisRuns,
  videos,
} from "@/db/schema";

// ============================================================================
// Transcript formatting
// ============================================================================

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

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
// POST - Run derived analysis (execute schema on-demand)
// ============================================================================

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { videoId, runId } = await params;
  const runIdNum = parseInt(runId, 10);

  if (Number.isNaN(runIdNum)) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  // Fetch the source run with its result
  const [sourceRun] = await db
    .select({
      id: videoAnalysisRuns.id,
      videoId: videoAnalysisRuns.videoId,
      result: videoAnalysisRuns.result,
    })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.id, runIdNum))
    .limit(1);

  if (!sourceRun) {
    return NextResponse.json(
      { error: "Source run not found" },
      { status: 404 },
    );
  }

  if (sourceRun.videoId !== videoId) {
    return NextResponse.json(
      { error: "Run does not belong to this video" },
      { status: 403 },
    );
  }

  if (!sourceRun.result?.schema) {
    return NextResponse.json(
      { error: "Source run has no schema" },
      { status: 400 },
    );
  }

  // Fetch transcript data
  const [transcriptRow] = await db
    .select({
      title: videos.title,
      channelName: channels.channelName,
      transcript: scrapTranscriptV1.transcript,
    })
    .from(videos)
    .innerJoin(channels, eq(videos.channelId, channels.channelId))
    .innerJoin(scrapTranscriptV1, eq(videos.videoId, scrapTranscriptV1.videoId))
    .where(eq(videos.videoId, videoId))
    .limit(1);

  if (!transcriptRow || !transcriptRow.transcript) {
    return NextResponse.json(
      { error: "Transcript not found" },
      { status: 404 },
    );
  }

  // Validate transcript
  const transcriptParseResult = z
    .array(TranscriptSegmentSchema)
    .safeParse(transcriptRow.transcript);

  if (!transcriptParseResult.success) {
    return NextResponse.json(
      { error: "Invalid transcript format" },
      { status: 500 },
    );
  }

  const formattedTranscript = formatTranscriptForLLM(
    transcriptParseResult.data,
  );

  // Create pending derived run
  const [derivedRun] = await db
    .insert(derivedAnalysisRuns)
    .values({
      sourceRunId: runIdNum,
      status: "pending",
    })
    .returning({ id: derivedAnalysisRuns.id });

  try {
    // Update status to streaming
    await db
      .update(derivedAnalysisRuns)
      .set({ status: "streaming" })
      .where(eq(derivedAnalysisRuns.id, derivedRun.id));

    // Run derived analysis
    const result = await generateDerivedAnalysis({
      title: transcriptRow.title,
      transcript: formattedTranscript,
      schema: sourceRun.result.schema,
    });

    // Save result
    await db
      .update(derivedAnalysisRuns)
      .set({
        analysis: result.sections,
        status: "completed",
      })
      .where(eq(derivedAnalysisRuns.id, derivedRun.id));

    return NextResponse.json({
      success: true,
      derivedRunId: derivedRun.id,
      analysis: result.sections,
    });
  } catch (error) {
    // Mark as failed
    await db
      .update(derivedAnalysisRuns)
      .set({ status: "failed" })
      .where(eq(derivedAnalysisRuns.id, derivedRun.id));

    console.error("Derived analysis failed:", error);
    return NextResponse.json(
      { error: "Derived analysis failed" },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET - List derived runs for a source run
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { runId } = await params;
  const runIdNum = parseInt(runId, 10);

  if (Number.isNaN(runIdNum)) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  const runs = await db
    .select()
    .from(derivedAnalysisRuns)
    .where(eq(derivedAnalysisRuns.sourceRunId, runIdNum));

  return NextResponse.json({ derivedRuns: runs });
}
