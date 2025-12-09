import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { z } from "zod";
import {
  type AnalysisStreamEvent,
  dynamicAnalysisWorkflow,
} from "@/app/workflows/dynamic-analysis";
import { db } from "@/db";
import { videoAnalysisRuns } from "@/db/schema";
import {
  createSSEResponse,
  resumeWorkflowStream,
  validateYouTubeVideoId,
} from "@/lib/api-utils";

// ============================================================================
// GET - List all analysis runs for a video
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const runs = await db
    .select({
      id: videoAnalysisRuns.id,
      version: videoAnalysisRuns.version,
      status: videoAnalysisRuns.status,
      result: videoAnalysisRuns.result,
      workflowRunId: videoAnalysisRuns.workflowRunId,
      additionalInstructions: videoAnalysisRuns.additionalInstructions,
      createdAt: videoAnalysisRuns.createdAt,
    })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId))
    .orderBy(desc(videoAnalysisRuns.version));

  // Check if there's a streaming run in progress
  let streamingRun = runs.find((r) => r.status === "streaming");

  // If a "streaming" run has a result, it actually completed - fix the status
  if (streamingRun?.result) {
    console.log(
      "⚙️⚙️⚙️ Found streaming run with result, marking as completed:",
      streamingRun.id,
    );
    await db
      .update(videoAnalysisRuns)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(videoAnalysisRuns.id, streamingRun.id));

    // Update local copy and clear streaming run since it's now completed
    const idx = runs.findIndex((r) => r.id === streamingRun?.id);
    if (idx >= 0) {
      runs[idx] = { ...runs[idx], status: "completed" };
    }
    streamingRun = undefined;
  }

  return NextResponse.json({
    videoId,
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
// POST - Start a new analysis run
// ============================================================================

const startAnalysisSchema = z.object({
  additionalInstructions: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate videoId format
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

  // Check if there's already a streaming run - don't start another
  const existingStreamingRun = await db
    .select({
      id: videoAnalysisRuns.id,
      workflowRunId: videoAnalysisRuns.workflowRunId,
    })
    .from(videoAnalysisRuns)
    .where(
      and(
        eq(videoAnalysisRuns.videoId, videoId),
        eq(videoAnalysisRuns.status, "streaming"),
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

  try {
    // Get the next version number
    const versionResult = await db
      .select({ version: videoAnalysisRuns.version })
      .from(videoAnalysisRuns)
      .where(eq(videoAnalysisRuns.videoId, videoId))
      .orderBy(desc(videoAnalysisRuns.version))
      .limit(1);

    const nextVersion = (versionResult[0]?.version ?? 0) + 1;

    // Create a streaming record before starting the workflow
    const [insertedRun] = await db
      .insert(videoAnalysisRuns)
      .values({
        videoId,
        version: nextVersion,
        status: "streaming",
        additionalInstructions: body.additionalInstructions ?? null,
        updatedAt: new Date(),
      })
      .returning({ id: videoAnalysisRuns.id });

    // Start the workflow
    const run = await start(dynamicAnalysisWorkflow, [
      videoId,
      body.additionalInstructions,
      insertedRun.id, // Pass the DB run ID to update status
    ]);

    // Update the record with the workflow run ID
    await db
      .update(videoAnalysisRuns)
      .set({ workflowRunId: run.runId })
      .where(eq(videoAnalysisRuns.id, insertedRun.id));

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error("Failed to start dynamic analysis workflow:", error);
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 },
    );
  }
}
