import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import {
  type AnalysisStreamEvent,
  dynamicAnalysisWorkflow,
} from "@/app/workflows/dynamic-analysis";
import { db } from "@/db";
import { videoAnalysisRuns } from "@/db/schema";

// ============================================================================
// GET - List all analysis runs for a video
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const runs = await db
    .select({
      id: videoAnalysisRuns.id,
      version: videoAnalysisRuns.version,
      status: videoAnalysisRuns.status,
      result: videoAnalysisRuns.result,
      additionalInstructions: videoAnalysisRuns.additionalInstructions,
      createdAt: videoAnalysisRuns.createdAt,
    })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.videoId, videoId))
    .orderBy(desc(videoAnalysisRuns.version));

  return NextResponse.json({
    videoId,
    runs,
    latestVersion: runs[0]?.version ?? 0,
  });
}

// ============================================================================
// POST - Start a new analysis run
// ============================================================================

const startAnalysisSchema = z.object({
  additionalInstructions: z.string().optional(),
});

export async function POST(
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

  // Parse request body
  let body: z.infer<typeof startAnalysisSchema> = {};
  try {
    const json = await request.json();
    const parsed = startAnalysisSchema.safeParse(json);
    if (parsed.success) {
      body = parsed.data;
    }
  } catch {
    // Empty body is fine
  }

  try {
    const run = await start(dynamicAnalysisWorkflow, [
      videoId,
      body.additionalInstructions,
    ]);

    // Transform to SSE
    const transformStream = new TransformStream<AnalysisStreamEvent, string>({
      transform(chunk, controller) {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
      },
    });

    const sseStream = run.readable.pipeThrough(transformStream);

    return new NextResponse(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Workflow-Run-Id": run.runId,
      },
    });
  } catch (error) {
    console.error("Failed to start dynamic analysis workflow:", error);
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 },
    );
  }
}
