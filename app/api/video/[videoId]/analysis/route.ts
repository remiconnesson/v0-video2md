import type { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  getCompletedAnalysis,
  getWorkflowRecord,
  storeWorkflowId,
} from "@/db/queries";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";
import { createWorkflowRouteHandler } from "@/lib/workflow-route-utils";
import {
  isValidYouTubeVideoId,
  type YouTubeVideoId,
} from "@/lib/youtube-utils";
import { analyzeTranscriptWorkflow } from "@/workflows/analyze-transcript";

const handleAnalysisWorkflow = createWorkflowRouteHandler({
  getCompletedResult: getCompletedAnalysis,
  getWorkflowRecord: getWorkflowRecord,
  startWorkflow: startNewAnalysisWorkflow,
  extractWorkflowId: (record) => record.workflowId,
});

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

  return handleAnalysisWorkflow(videoId);
}

async function startNewAnalysisWorkflow(
  videoId: YouTubeVideoId,
): Promise<NextResponse> {
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
