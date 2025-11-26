import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  fetchAndStoreTranscriptWorkflow,
  type TranscriptWorkflowEvent,
} from "@/app/workflows/fetch-transcript";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate videoId format (YouTube video IDs are 11 characters)
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Invalid YouTube video ID format" },
      { status: 400 },
    );
  }

  try {
    const run = await start(fetchAndStoreTranscriptWorkflow, [videoId]);

    // Transform the object stream to SSE-formatted text stream
    const transformStream = new TransformStream<
      TranscriptWorkflowEvent,
      string
    >({
      transform(chunk, controller) {
        // Serialize objects to SSE format
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
    console.error("Failed to start transcript workflow:", error);
    return NextResponse.json(
      { error: "Failed to start transcript processing" },
      { status: 500 },
    );
  }
}
