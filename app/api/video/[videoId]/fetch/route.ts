import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  fetchTranscriptWorkflow,
  type TranscriptStreamEvent,
} from "@/app/workflows/fetch-transcript";

// ============================================================================
// POST - Fetch transcript from YouTube via workflow
// ============================================================================

export async function POST(
  _request: Request,
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

  try {
    const run = await start(fetchTranscriptWorkflow, [videoId]);

    // Transform to SSE
    const transformStream = new TransformStream<TranscriptStreamEvent, string>({
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
    console.error("Failed to start fetch transcript workflow:", error);
    return NextResponse.json(
      { error: "Failed to start transcript fetch" },
      { status: 500 },
    );
  }
}
