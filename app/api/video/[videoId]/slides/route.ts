import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  deleteSlideExtraction,
  deleteVideoSlides,
  getSlideExtractionStatus,
  getVideoSlides,
  updateSlideExtractionRunId,
  updateSlideExtractionStatus,
  upsertSlideExtraction,
} from "@/db/queries";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";
import { extractSlidesWorkflow } from "@/workflows/extract-slides";

// ============================================================================
// GET - Get extraction status and existing slides
// ============================================================================

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides">,
) {
  const { videoId } = await ctx.params;

  // Get extraction status
  const extraction = await getSlideExtractionStatus(videoId);

  // Get existing slides
  const slides = await getVideoSlides(videoId);

  // If extraction status is "in_progress" but we have slides, fix the status
  // This handles the case where extraction completed but status wasn't updated
  let status = extraction?.status ?? "idle";
  if (extraction && status === "in_progress" && slides.length > 0) {
    console.log(
      "⚙️ Found in_progress extraction with slides, marking as completed:",
      videoId,
    );
    await updateSlideExtractionStatus(videoId, "completed", slides.length);
    status = "completed";
  }

  // If extraction status is "completed" but we have no slides, this is a data inconsistency
  // Mark as failed so user can retry
  if (extraction && status === "completed" && slides.length === 0) {
    console.log(
      "⚙️ Found completed extraction with no slides (data inconsistency), marking as failed:",
      videoId,
    );
    await updateSlideExtractionStatus(
      videoId,
      "failed",
      undefined,
      "Extraction completed but no slides were saved. Please try again.",
    );
    status = "failed";
  }

  // If extraction status is "in_progress" but hasn't been updated for 30+ minutes,
  // mark as failed so user can retry
  if (extraction && status === "in_progress" && slides.length === 0) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const lastUpdate = extraction.createdAt;

    if (lastUpdate < thirtyMinutesAgo) {
      console.log(
        "⚙️ Found stuck in_progress extraction (>30min old), marking as failed:",
        videoId,
      );
      await updateSlideExtractionStatus(
        videoId,
        "failed",
        undefined,
        "Extraction timed out or workflow failed to start. Please try again.",
      );
      status = "failed";
    }
  }

  return NextResponse.json({
    status,
    runId: extraction?.runId ?? null,
    totalSlides: extraction?.totalSlides ?? slides.length,
    errorMessage: extraction?.errorMessage ?? null,
    slides: slides.map((s) => ({
      slideNumber: s.slideNumber,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      firstFrameImageUrl: s.firstFrameImageUrl,
      firstFrameIsDuplicate: s.firstFrameIsDuplicate,
      firstFrameDuplicateOfSlideNumber: s.firstFrameDuplicateOfSlideNumber,
      firstFrameDuplicateOfFramePosition: s.firstFrameDuplicateOfFramePosition,
      lastFrameImageUrl: s.lastFrameImageUrl,
      lastFrameIsDuplicate: s.lastFrameIsDuplicate,
      lastFrameDuplicateOfSlideNumber: s.lastFrameDuplicateOfSlideNumber,
      lastFrameDuplicateOfFramePosition: s.lastFrameDuplicateOfFramePosition,
    })),
  });
}

// ============================================================================
// POST - Start slide extraction
// ============================================================================

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides">,
) {
  const { videoId } = await ctx.params;

  // Check for existing extraction
  const existing = await getSlideExtractionStatus(videoId);

  // If already completed, return existing data
  if (existing?.status === "completed") {
    return errorResponse("Slides already extracted", 409, {
      context: { status: "completed" },
    });
  }

  // If in progress, return conflict
  if (existing?.status === "in_progress") {
    return errorResponse("Extraction already in progress", 409, {
      context: { runId: existing.runId },
    });
  }

  // If retrying after failure, delete existing slides first
  if (existing?.status === "failed") {
    await deleteVideoSlides(videoId);
  }

  // Create or update extraction record
  await upsertSlideExtraction(videoId, "in_progress");

  try {
    // Start workflow
    const run = await start(extractSlidesWorkflow, [videoId]);

    // Update with runId
    await updateSlideExtractionRunId(videoId, run.runId);

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    logError(error, "Failed to start slides workflow", { videoId });

    // Revert DB state so user can try again
    await deleteSlideExtraction(videoId);

    return errorResponse("Failed to start extraction workflow", 500);
  }
}
