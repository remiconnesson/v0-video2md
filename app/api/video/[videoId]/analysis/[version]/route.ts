import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import { z } from "zod";
import { transcriptAnalysisWorkflow } from "@/app/workflows/transcript-analysis";
import { db } from "@/db";
import { videoAnalysisRuns, videoAnalysisWorkflowIds } from "@/db/schema";
import { createSSEResponse, validateYouTubeVideoId } from "@/lib/api-utils";

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

  // Validate YouTube video ID
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) {
    return validationError;
  }

  const v = z.number().int().positive().parse(version);

  // Check for completed analysis in the database
  const [completedRun] = await db
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

  // If we have a completed analysis, return it
  if (completedRun) {
    return NextResponse.json({
      status: "completed",
      result: completedRun.result,
      additionalInstructions: completedRun.additionalInstructions,
      createdAt: completedRun.createdAt,
    });
  }

  // Check for ongoing workflow
  const [workflowRecord] = await db
    .select()
    .from(videoAnalysisWorkflowIds)
    .where(
      and(
        eq(videoAnalysisWorkflowIds.videoId, videoId),
        eq(videoAnalysisWorkflowIds.version, v),
      ),
    );

  if (workflowRecord) {
    // We have an ongoing workflow, check its status
    try {
      const run = getRun(workflowRecord.workflowId);

      // Check the status of the workflow run
      // Note: The workflow library likely has status properties on the run object
      // For now, we'll assume we can get the status and handle it accordingly

      // If completed, this would be an anomaly since we didn't find it in videoAnalysisRuns
      // If failed, return error
      // If running, return the stream
      // For now, assume we can resume the stream
      const readable = run.getReadable();
      return createSSEResponse(readable, workflowRecord.workflowId);
    } catch (error) {
      console.error("Failed to get workflow run:", error);
      return NextResponse.json(
        { error: "Analysis workflow failed or is no longer available" },
        { status: 500 },
      );
    }
  }

  // No completed analysis and no ongoing workflow, start a new analysis
  try {
    // Start the transcript analysis workflow
    const run = await start(transcriptAnalysisWorkflow, [videoId, v]);

    // Store the workflow ID in the database for future reference
    await db
      .insert(videoAnalysisWorkflowIds)
      .values({
        videoId,
        version: v,
        workflowId: run.runId,
      })
      .onConflictDoUpdate({
        target: [
          videoAnalysisWorkflowIds.videoId,
          videoAnalysisWorkflowIds.version,
        ],
        set: {
          workflowId: run.runId,
          createdAt: new Date(),
        },
      });

    // Return the SSE response with the workflow stream
    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error("Failed to start analysis workflow:", error);
    return NextResponse.json(
      { error: "Failed to start analysis workflow" },
      { status: 500 },
    );
  }
}
