import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { z } from "zod";
import {
  type AnalysisStreamEvent,
  externalTranscriptAnalysisWorkflow,
} from "@/app/workflows/external-transcript-analysis";
import { db } from "@/db";
import { externalTranscriptAnalysisRuns } from "@/db/schema";
import { createSSEResponse, resumeWorkflowStream } from "@/lib/api-utils";

// ============================================================================
// GET - List all analysis runs for an external transcript
// ============================================================================

export async function GET(
  _request: Request,
  props: { params: Promise<{ transcriptId: string }> },
) {
  const params = await props.params;
  const { transcriptId } = params;

  const runs = await db
    .select({
      id: externalTranscriptAnalysisRuns.id,
      version: externalTranscriptAnalysisRuns.version,
      status: externalTranscriptAnalysisRuns.status,
      result: externalTranscriptAnalysisRuns.result,
      workflowRunId: externalTranscriptAnalysisRuns.workflowRunId,
      additionalInstructions:
        externalTranscriptAnalysisRuns.additionalInstructions,
      createdAt: externalTranscriptAnalysisRuns.createdAt,
    })
    .from(externalTranscriptAnalysisRuns)
    .where(eq(externalTranscriptAnalysisRuns.transcriptId, transcriptId))
    .orderBy(desc(externalTranscriptAnalysisRuns.version));

  // Check if there's a streaming run in progress
  let streamingRun = runs.find((r) => r.status === "streaming");

  // If a "streaming" run has a result, it actually completed - fix the status
  if (streamingRun?.result) {
    console.log(
      "⚙️⚙️⚙️ Found streaming run with result, marking as completed:",
      streamingRun.id,
    );
    await db
      .update(externalTranscriptAnalysisRuns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(externalTranscriptAnalysisRuns.id, streamingRun.id));

    // Update local copy and clear streaming run since it's now completed
    const idx = runs.findIndex((r) => r.id === streamingRun?.id);
    if (idx >= 0) {
      runs[idx] = { ...runs[idx], status: "completed" };
    }
    streamingRun = undefined;
  }

  return NextResponse.json({
    transcriptId,
    runs,
    latestVersion: runs[0]?.version ?? 0,
    streamingRun: streamingRun?.workflowRunId
      ? {
          id: streamingRun.id,
          version: streamingRun.version,
          workflowRunId: streamingRun.workflowRunId,
        }
      : null,
  });
}

// ============================================================================
// POST - Start a new analysis run for external transcript
// ============================================================================

const startAnalysisSchema = z.object({
  additionalInstructions: z.string().optional(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ transcriptId: string }> },
) {
  const params = await props.params;
  const { transcriptId } = params;

  // Check if there's already a streaming run - don't start another
  const existingStreamingRun = await db
    .select({
      id: externalTranscriptAnalysisRuns.id,
      workflowRunId: externalTranscriptAnalysisRuns.workflowRunId,
    })
    .from(externalTranscriptAnalysisRuns)
    .where(
      and(
        eq(externalTranscriptAnalysisRuns.transcriptId, transcriptId),
        eq(externalTranscriptAnalysisRuns.status, "streaming"),
      ),
    )
    .limit(1);

  if (existingStreamingRun[0]?.workflowRunId) {
    // Resume the existing stream instead of starting a new one
    return resumeWorkflowStream<AnalysisStreamEvent>(
      getRun,
      existingStreamingRun[0].workflowRunId,
    );
  }

  // Parse request body
  let body: z.infer<typeof startAnalysisSchema> = {};
  try {
    const json = await request.json();
    const parsed = startAnalysisSchema.safeParse(json);
    if (parsed.success) {
      body = parsed.data;
    }
  } catch {
    // Empty body is fine
  }

  let insertedRunId: number | null = null;

  try {
    // Get the next version number
    const versionResult = await db
      .select({ version: externalTranscriptAnalysisRuns.version })
      .from(externalTranscriptAnalysisRuns)
      .where(eq(externalTranscriptAnalysisRuns.transcriptId, transcriptId))
      .orderBy(desc(externalTranscriptAnalysisRuns.version))
      .limit(1);

    const nextVersion = (versionResult[0]?.version ?? 0) + 1;

    // Create a streaming record before starting the workflow
    const [insertedRun] = await db
      .insert(externalTranscriptAnalysisRuns)
      .values({
        transcriptId,
        version: nextVersion,
        status: "streaming",
        additionalInstructions: body.additionalInstructions ?? null,
        updatedAt: new Date(),
      })
      .returning({ id: externalTranscriptAnalysisRuns.id });

    insertedRunId = insertedRun.id;

    // Start the workflow
    const run = await start(externalTranscriptAnalysisWorkflow, [
      transcriptId,
      body.additionalInstructions,
      insertedRun.id, // Pass the DB run ID to update status
    ]);

    // Update the record with the workflow run ID
    await db
      .update(externalTranscriptAnalysisRuns)
      .set({ workflowRunId: run.runId })
      .where(eq(externalTranscriptAnalysisRuns.id, insertedRun.id));

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error(
      "Failed to start external transcript analysis workflow:",
      error,
    );

    if (insertedRunId) {
      try {
        await db
          .update(externalTranscriptAnalysisRuns)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(externalTranscriptAnalysisRuns.id, insertedRunId));
      } catch (cleanupError) {
        console.error(
          "Failed to clean up external transcript analysis run:",
          cleanupError,
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 },
    );
  }
}
