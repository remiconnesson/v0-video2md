import { Match } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import {
  getCompletedAnalysis,
  getWorkflowRecord,
  storeWorkflowId,
} from "@/db/queries";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";
import type { YouTubeVideoId } from "@/lib/youtube-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { analyzeTranscriptWorkflow } from "@/workflows/analyze-transcript";

export async function GET(
  _req: NextRequest,
  // note for LLMs: this type doesn't need to be imported
  ctx: RouteContext<"/api/video/[videoId]/analysis">,
) {
  const { videoId } = await ctx.params;

  // Validate YouTube video ID
  if (!isValidYouTubeVideoId(videoId)) {
    return errorResponse("Invalid YouTube video ID format", 400, {
      context: { videoId },
    });
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

// Note: getWorkflowRecord is now imported from queries

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
  return errorResponse("Internal server error", 500); // hide the details of the error
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

async function startNewAnalysisWorkflow({
  videoId,
}: {
  videoId: YouTubeVideoId;
}) {
  try {
    // Start the transcript analysis workflow
    const run = await start(analyzeTranscriptWorkflow, [videoId]);

    // Store the workflow ID in the database for future reference
    await storeWorkflowId(videoId, run.runId);

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    logError(error, "Failed to start analysis workflow", { videoId });
    return errorResponse("Failed to start analysis workflow", 500);
  }
}
