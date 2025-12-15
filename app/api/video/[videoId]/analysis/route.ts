import { eq } from "drizzle-orm";
import { Match } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { analyzeTranscriptWorkflow } from "@/app/workflows/analyze-transcript";
import { db } from "@/db";
import {
  type VideoAnalysisRun,
  videoAnalysisRuns,
  videoAnalysisWorkflowIds,
} from "@/db/schema";
import { createSSEResponse } from "@/lib/api-utils";
import type { YouTubeVideoId } from "@/lib/youtube-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";

class InvalidYouTubeVideoIdErrorResponse extends NextResponse {
  constructor(videoId: string) {
    super(
      JSON.stringify({ error: "Invalid YouTube video ID format", videoId }),
      { status: 400 },
    );
  }
}

export async function GET(
  _req: NextRequest,
  // note for LLMs: this type doesn't need to be imported
  ctx: RouteContext<"/api/video/[videoId]/analysis">,
) {
  const { videoId } = await ctx.params;

  // Validate YouTube video ID
  if (!isValidYouTubeVideoId(videoId)) {
    return new InvalidYouTubeVideoIdErrorResponse(videoId);
  }

  // Check for completed analysis in the database
  const analysis = await getCompletedAnalysis(videoId);

  // If we have a completed analysis, return it
  if (analysis) {
    return NextResponse.json(analysis);
  }

  const workflowRecord = await getWorkflowRecord(videoId);

  if (workflowRecord) {
    const workflowId = workflowRecord.workflowId;
    const run = getRun(workflowId);
    const status = await run.status;
    const readable = run.readable;

    return dispatchOngoingWorkflowHandler({
      workflowId,
      videoId,
      readable,
      status,
    });
  }

  // No completed analysis and no ongoing workflow, start a new analysis
  return startNewAnalysisWorkflow({ videoId });
}

async function getWorkflowRecord(videoId: string) {
  const [workflowRecord] = await db
    .select()
    .from(videoAnalysisWorkflowIds)
    .where(eq(videoAnalysisWorkflowIds.videoId, videoId));
  return workflowRecord;
}

function dispatchOngoingWorkflowHandler({
  workflowId,
  videoId,
  readable,
  status,
}: {
  workflowId: string;
  videoId: string;
  readable: ReadableStream;
  status:
    | "completed"
    | "failed"
    | "cancelled"
    | "pending"
    | "running"
    | "paused";
}) {
  const response = Match.value(status).pipe(
    Match.withReturnType<NextResponse>(),
    Match.when("completed", () =>
      handleWorkflowAnomaly({ workflowId, videoId }),
    ),
    Match.when("failed", () => handleWorkflowFailed()),
    Match.when("cancelled", () => handleWorkflowFailed()),
    Match.when("pending", () =>
      handleWorkflowInProgress({ readable, workflowId }),
    ),
    Match.when("running", () =>
      handleWorkflowInProgress({ readable, workflowId }),
    ),
    Match.when("paused", () =>
      handleWorkflowInProgress({ readable, workflowId }),
    ),
    Match.exhaustive,
  );

  return response;
}

function handleWorkflowAnomaly({
  workflowId,
  videoId,
}: {
  workflowId: string;
  videoId: string;
}) {
  console.error(
    `Workflow ${workflowId} for video ${videoId} appears to be completed but not found in database`,
  );
  return NextResponse.json(
    { error: "Internal server error" }, // hide the details of the error
    { status: 500 },
  );
}

function handleWorkflowFailed() {
  return NextResponse.json(
    { error: "Workflow failed or cancelled" },
    { status: 500 },
  );
}

function handleWorkflowInProgress({
  readable,
  workflowId,
}: {
  readable: ReadableStream;
  workflowId: string;
}) {
  return createSSEResponse(readable, workflowId);
}

async function startNewAnalysisWorkflow({
  videoId,
}: {
  videoId: YouTubeVideoId;
}) {
  try {
    // Start the transcript analysis workflow
    const run = await start(analyzeTranscriptWorkflow, [videoId]);

    // Store the workflow ID in the database for future reference
    await storeWorkflowId({ videoId, workflowId: run.runId });

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error("Failed to start analysis workflow:", error);
    return NextResponse.json(
      { error: "Failed to start analysis workflow" },
      { status: 500 },
    );
  }
}

async function getCompletedAnalysis(
  videoId: YouTubeVideoId,
): Promise<VideoAnalysisRun | null> {
  const [analysis] = await db
    .select({
      videoId: videoAnalysisRuns.videoId,
      result: videoAnalysisRuns.result,
      createdAt: videoAnalysisRuns.createdAt,
    })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId));

  return analysis;
}

async function storeWorkflowId({
  videoId,
  workflowId,
}: {
  videoId: YouTubeVideoId;
  workflowId: string;
}) {
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
