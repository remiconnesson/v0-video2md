import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { db } from "@/db";
import { videoAnalysisRuns } from "@/db/schema";

// ============================================================================
// GET - Resume streaming for an in-progress analysis
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Invalid YouTube video ID format" },
      { status: 400 },
    );
  }

  // Find the streaming run for this video
  const [streamingRun] = await db
    .select({
      id: videoAnalysisRuns.id,
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

  // Get optional startIndex for resumption
  const url = new URL(request.url);
  const startIndexParam = url.searchParams.get("startIndex");
  const startIndex = startIndexParam
    ? parseInt(startIndexParam, 10)
    : undefined;

  try {
    const run = getRun(streamingRun.workflowRunId);
    const readable = run.getReadable({ startIndex });

    // Transform to SSE
    const transformStream = new TransformStream<AnalysisStreamEvent, string>({
      transform(chunk, controller) {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
      },
    });

    const sseStream = readable.pipeThrough(transformStream);

    return new NextResponse(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Workflow-Run-Id": streamingRun.workflowRunId,
      },
    });
  } catch (error) {
    console.error("Failed to resume workflow stream:", error);

    // The workflow might have finished or crashed - mark as failed
    await db
      .update(videoAnalysisRuns)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(videoAnalysisRuns.id, streamingRun.id));

    return NextResponse.json(
      { error: "Failed to resume stream - workflow may have ended" },
      { status: 410 },
    );
  }
}
