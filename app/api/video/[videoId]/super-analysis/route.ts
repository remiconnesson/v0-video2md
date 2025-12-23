import { type NextRequest, NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import {
  getCompletedSuperAnalysis,
  getSuperAnalysisWorkflowId,
  storeSuperAnalysisWorkflowId,
} from "@/db/queries";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";
import { dispatchOngoingWorkflowHandler } from "@/lib/workflow-route-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { superAnalysisWorkflow } from "@/workflows/super-analysis";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/video/[videoId]/super-analysis">,
) {
  const { videoId } = await ctx.params;
  const searchParams = req.nextUrl.searchParams;
  const trigger = searchParams.get("trigger") === "true";

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

    // If the workflow failed or was cancelled, we allow starting a new one if triggered
    if ((status === "failed" || status === "cancelled") && trigger) {
      return startNewSuperAnalysisWorkflow(videoId);
    }

    // Use the shared handler for ongoing workflows
    return dispatchOngoingWorkflowHandler({
      workflowId,
      videoId,
      readable,
      status,
    });
  }

  if (trigger) {
    return startNewSuperAnalysisWorkflow(videoId);
  }

  return NextResponse.json({ status: "not_started" });
}

async function startNewSuperAnalysisWorkflow(
  videoId: string,
): Promise<NextResponse> {
  try {
    const run = await start(superAnalysisWorkflow, [videoId]);

    await storeSuperAnalysisWorkflowId(videoId, run.runId);

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    logError(error, "Failed to start super analysis workflow", { videoId });
    return errorResponse("Failed to start super analysis workflow", 500);
  }
}
