import { and, eq } from "drizzle-orm";
import { Match } from "effect";
import { type NextRequest, NextResponse, type RouteContext } from "next/server";
import { getRun, start } from "workflow/api";
import { z } from "zod";
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
  ctx: RouteContext<"/video/[videoId]/analysis/[version]">,
) {
  const { videoId, version: versionParam } = await ctx.params;

  // Validate YouTube video ID
  if (!isValidYouTubeVideoId(videoId)) {
    return new InvalidYouTubeVideoIdErrorResponse(videoId);
  }

  const version = parseVersion(versionParam);

  // Check for completed analysis in the database
  const analysis = await getCompletedAnalysis(videoId, version);

  // If we have a completed analysis, return it
  if (analysis) {
    return NextResponse.json(analysis);
  }

  const workflowRecord = await getWorkflowRecord(videoId, version);

  if (workflowRecord) {
    const workflowId = workflowRecord.workflowId;
    const run = getRun(workflowId);
    const status = await run.status;
    const readable = run.readable;

    return dispatchOngoingWorkflowHandler({
      workflowId,
      videoId,
      version,
      readable,
      status,
    });
  }

  // No completed analysis and no ongoing workflow, start a new analysis
  return startNewAnalysisWorkflow({ videoId, version });
}

async function getWorkflowRecord(videoId: string, version: number) {
  const [workflowRecord] = await db
    .select()
    .from(videoAnalysisWorkflowIds)
    .where(
      and(
        eq(videoAnalysisWorkflowIds.videoId, videoId),
        eq(videoAnalysisWorkflowIds.version, version),
      ),
    );
  return workflowRecord;
}

function dispatchOngoingWorkflowHandler({
  workflowId,
  videoId,
  version,
  readable,
  status,
}: {
  workflowId: string;
  videoId: string;
  version: number;
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
      handleWorkflowAnomaly({ workflowId, videoId, version }),
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
  version,
}: {
  workflowId: string;
  videoId: string;
  version: number;
}) {
  console.error(
    `Workflow ${workflowId} for video ${videoId} version ${version} appears to be completed but not found in database`,
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
  version,
}: {
  videoId: YouTubeVideoId;
  version: number;
}) {
  try {
    // Start the transcript analysis workflow
    const run = await start(analyzeTranscriptWorkflow, [videoId, version]);

    // Store the workflow ID in the database for future reference
    await storeWorkflowId({ videoId, version, workflowId: run.runId });

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error("Failed to start analysis workflow:", error);
    return NextResponse.json(
      { error: "Failed to start analysis workflow" },
      { status: 500 },
    );
  }
}

function parseVersion(version: unknown): number {
  return z.number().int().positive().parse(version);
}

async function getCompletedAnalysis(
  videoId: YouTubeVideoId,
  version: number,
): Promise<VideoAnalysisRun | null> {
  const [analysis] = await db
    .select({
      videoId: videoAnalysisRuns.videoId,
      version: videoAnalysisRuns.version,
      result: videoAnalysisRuns.result,
      createdAt: videoAnalysisRuns.createdAt,
    })
    .from(videoAnalysisRuns)
    .where(
      and(
        eq(videoAnalysisRuns.videoId, videoId),
        eq(videoAnalysisRuns.version, version),
      ),
    );

  return analysis;
}

async function storeWorkflowId({
  videoId,
  version,
  workflowId,
}: {
  videoId: YouTubeVideoId;
  version: number;
  workflowId: string;
}) {
  await db
    .insert(videoAnalysisWorkflowIds)
    .values({
      videoId,
      version,
      workflowId,
    })
    .onConflictDoUpdate({
      target: [
        videoAnalysisWorkflowIds.videoId,
        videoAnalysisWorkflowIds.version,
      ],
      set: {
        workflowId,
        createdAt: new Date(),
      },
    });
}
