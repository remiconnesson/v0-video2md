import { Match } from "effect";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";
import type { YouTubeVideoId } from "@/lib/youtube-utils";

export type WorkflowStatus =
  | "completed"
  | "failed"
  | "cancelled"
  | "pending"
  | "running"
  | "paused";

export interface WorkflowRouteOptions<TCompletedResult, TWorkflowRecord> {
  getCompletedResult: (
    videoId: YouTubeVideoId,
  ) => Promise<TCompletedResult | null>;
  getWorkflowRecord: (
    videoId: YouTubeVideoId,
  ) => Promise<TWorkflowRecord | null>;
  startWorkflow: (videoId: YouTubeVideoId) => Promise<NextResponse>;
  extractWorkflowId: (record: TWorkflowRecord) => string;
}

/**
 * Public API facade for handling ongoing workflow responses.
 * Delegates to dispatchOngoingWorkflowHandler for actual status dispatch.
 * Kept as a separate function for API clarity and stable public interface.
 */
export function handleOngoingWorkflowHandler({
  workflowId,
  videoId,
  readable,
  status,
}: {
  workflowId: string;
  videoId: string;
  readable: ReadableStream;
  status: WorkflowStatus;
}): NextResponse {
  return dispatchOngoingWorkflowHandler({
    workflowId,
    videoId,
    readable,
    status,
  });
}

export function createWorkflowRouteHandler<TCompletedResult, TWorkflowRecord>(
  options: WorkflowRouteOptions<TCompletedResult, TWorkflowRecord>,
) {
  return async function handleWorkflowRoute(
    videoId: YouTubeVideoId,
    additionalLogic?: {
      customStatusHandler?: (
        status: WorkflowStatus,
        workflowId: string,
        readable: ReadableStream,
      ) => NextResponse | null;
    },
  ): Promise<NextResponse> {
    // Check for completed result in the database
    const completedResult = await options.getCompletedResult(videoId);

    // If we have a completed result, return it
    if (completedResult) {
      return NextResponse.json(completedResult);
    }

    const workflowRecord = await options.getWorkflowRecord(videoId);

    if (workflowRecord) {
      const workflowId = options.extractWorkflowId(workflowRecord);
      const run = getRun(workflowId);
      const status = await run.status;
      const readable = run.readable;

      // Allow custom status handling (e.g., for restarting failed workflows)
      if (additionalLogic?.customStatusHandler) {
        const customResponse = additionalLogic.customStatusHandler(
          status,
          workflowId,
          readable,
        );
        if (customResponse) return customResponse;
      }

      return dispatchOngoingWorkflowHandler({
        workflowId,
        videoId,
        readable,
        status,
      });
    }

    // No completed result and no ongoing workflow, start a new one
    return options.startWorkflow(videoId);
  };
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
  status: WorkflowStatus;
}): NextResponse {
  return Match.value(status).pipe(
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
}

function handleWorkflowAnomaly({
  workflowId,
  videoId,
}: {
  workflowId: string;
  videoId: string;
}): NextResponse {
  logError(
    new Error("Workflow appears completed but not found in database"),
    "Workflow anomaly",
    { workflowId, videoId },
  );
  return errorResponse("Internal server error", 500);
}

function handleWorkflowFailed(): NextResponse {
  return errorResponse("Workflow failed or cancelled", 500);
}

function handleWorkflowInProgress({
  readable,
  workflowId,
}: {
  readable: ReadableStream;
  workflowId: string;
}): NextResponse {
  return createSSEResponse(readable, workflowId);
}
