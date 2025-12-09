import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { db } from "@/db";
import { videoAnalysisRuns } from "@/db/schema";
import { resumeWorkflowStream, validateYouTubeVideoId } from "@/lib/api-utils";

// ============================================================================
// GET - Resume streaming for an in-progress analysis
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate videoId format
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

  // Find the streaming run for this video
  const [streamingRun] = await db
    .select({
      id: videoAnalysisRuns.id,
      status: videoAnalysisRuns.status,
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

  if (!streamingRun?.workflowRunId) {
    return NextResponse.json(
      { error: "No streaming analysis found for this video" },
      { status: 404 },
    );
  }

  // Get optional startIndex for resumption - default to 0 to replay all events
  const url = new URL(request.url);
  const startIndexParam = url.searchParams.get("startIndex");
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : 0;

  try {
    return resumeWorkflowStream<AnalysisStreamEvent>(
      getRun,
      streamingRun.workflowRunId,
      startIndex,
    );
  } catch (error) {
    console.error("Failed to resume workflow stream:", error);

    // Re-check if the run completed while we were trying to connect
    // Don't mark as failed if it actually completed successfully
    const [currentRun] = await db
      .select({ status: videoAnalysisRuns.status })
      .from(videoAnalysisRuns)
      .where(eq(videoAnalysisRuns.id, streamingRun.id))
      .limit(1);

    if (currentRun?.status === "completed") {
      // Run finished successfully - client should reload to see result
      return NextResponse.json(
        { error: "Analysis completed", completed: true },
        { status: 410 },
      );
    }

    // Only mark as failed if status is still streaming (indicates actual failure)
    if (currentRun?.status === "streaming") {
      await db
        .update(videoAnalysisRuns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(videoAnalysisRuns.id, streamingRun.id));
    }

    return NextResponse.json(
      { error: "Failed to resume stream - workflow may have ended" },
      { status: 410 },
    );
  }
}
