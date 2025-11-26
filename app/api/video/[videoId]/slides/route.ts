import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const body = await request.json().catch(() => ({}));
  const chapters = body.chapters;

  try {
    const run = await start(extractSlidesWorkflow, [videoId, chapters]);

    return new NextResponse(run.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Workflow-Run-Id": run.runId,
      },
    });
  } catch (error) {
    console.error("Failed to start slides extraction:", error);
    return NextResponse.json(
      { error: "Failed to start slide extraction" },
      { status: 500 },
    );
  }
}
