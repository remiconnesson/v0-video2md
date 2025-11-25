// app/api/video/[videoId]/slides/route.ts

import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import type { Chapter } from "@/ai/transcript-to-book-schema";

interface RequestBody {
  chapters?: Chapter[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  let body: RequestBody = {};
  try {
    body = await request.json();
  } catch {
    // No body or invalid JSON is fine
  }

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

// GET endpoint for checking slide extraction status (optional)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Return info about the video's slide extraction capability
  return NextResponse.json({
    videoId,
    extractionAvailable: true,
    message: "POST to this endpoint to start slide extraction",
  });
}
