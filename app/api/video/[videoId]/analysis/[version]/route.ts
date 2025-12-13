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

/*
 scratch pad

 1. version selector should be just a link to an analysis
 2. we trigger analysis on visit 
 3. a reroll will post to analysie/<nextVersion>
*/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string; version: number }> },
) {
  const { videoId, version } = await params;

  const v = z.number().int().positive().parse(version);

  // TODO: extract to fetchAnalysisByIdAndVersion
  const runs = await db
    .select({
      videoId: videoAnalysisRuns.videoId,
      version: videoAnalysisRuns.version,
      result: videoAnalysisRuns.result,
      additionalInstructions: videoAnalysisRuns.additionalInstructions,
      createdAt: videoAnalysisRuns.createdAt,
    })
    .from(videoAnalysisRuns)
    .where(
      and(
        eq(videoAnalysisRuns.videoId, videoId),
        eq(videoAnalysisRuns.version, v),
      ),
    );

  // TODO: if any return

  /*
  else check the workflow run id DB
  if any:
   
  run = getRun(runId)

  if run.status === "completed": log an error, this is an anomaly
  if run.status === "failed": retun an error indicating that it failed, UI will give the option to retry
  if run.status === "pending": not clear what this means... search for the meaning of it
  if run.status === "running": then we want to return a readable using run.readable (ReadableStream)
  if run.status === "paused": not clear what this means... search for the meaning of it

  if we start an analysis, we need to add a record to the DB with the workflow run id

  and then return the readable stream of the created workflow
  ```
  // pseudo code
  const run = await start()
  return run.readable
  ```
  */

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
