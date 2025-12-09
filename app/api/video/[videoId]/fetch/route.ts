import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { fetchTranscriptWorkflow } from "@/app/workflows/fetch-transcript";
import { createSSEResponse, validateYouTubeVideoId } from "@/lib/api-utils";

// ============================================================================
// POST - Fetch transcript from YouTube via workflow
// ============================================================================

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Validate videoId format
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

  try {
    const run = await start(fetchTranscriptWorkflow, [videoId]);

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error("Failed to start fetch transcript workflow:", error);
    return NextResponse.json(
      { error: "Failed to start transcript fetch" },
      { status: 500 },
    );
  }
}
