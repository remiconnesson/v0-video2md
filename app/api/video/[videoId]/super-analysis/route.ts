import { Match } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import {
  getCompletedSuperAnalysis,
  getSuperAnalysisWorkflowId,
  storeSuperAnalysisWorkflowId,
} from "@/db/queries";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";
import type { YouTubeVideoId } from "@/lib/youtube-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { superAnalysisWorkflow } from "@/workflows/super-analysis";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/video/[videoId]/super-analysis">,
) {
  const { videoId } = await ctx.params;

  if (!isValidYouTubeVideoId(videoId)) {
    return errorResponse("Invalid YouTube video ID format", 400, {
      context: { videoId },
    });
  }

  const analysis = await getCompletedSuperAnalysis(videoId);

  if (analysis) {
    return NextResponse.json(analysis);
  }

  const workflowRecord = await getSuperAnalysisWorkflowId(videoId);

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

  return startNewSuperAnalysisWorkflow({ videoId });
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
  logError(
    new Error("Workflow appears completed but not found in database"),
    "Workflow anomaly",
    { workflowId, videoId },
  );
  return errorResponse("Internal server error", 500);
}

function handleWorkflowFailed() {
  return errorResponse("Workflow failed or cancelled", 500);
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

async function startNewSuperAnalysisWorkflow({
  videoId,
}: {
  videoId: YouTubeVideoId;
}) {
  try {
    const run = await start(superAnalysisWorkflow, [videoId]);

    await storeSuperAnalysisWorkflowId(videoId, run.runId);

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    logError(error, "Failed to start super analysis workflow", { videoId });
    return errorResponse("Failed to start super analysis workflow", 500);
  }
}
