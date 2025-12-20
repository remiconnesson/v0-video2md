import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { db } from "@/db";
import { videoSlideExtractions, videoSlides } from "@/db/schema";
import { createSSEResponse } from "@/lib/api-utils";
import { extractSlidesWorkflow } from "@/workflows/extract-slides";

// ============================================================================
// GET - Get extraction status and existing slides
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Get extraction status
  const [extraction] = await db
    .select()
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  // Get existing slides
  const slides = await db
    .select({
      slideIndex: videoSlides.slideIndex,
      frameId: videoSlides.frameId,
      startTime: videoSlides.startTime,
      endTime: videoSlides.endTime,
      duration: videoSlides.duration,
      // First frame data
      firstFrameImageUrl: videoSlides.firstFrameImageUrl,
      firstFrameIsDuplicate: videoSlides.firstFrameIsDuplicate,
      firstFrameDuplicateOfSegmentId:
        videoSlides.firstFrameDuplicateOfSegmentId,
      firstFrameDuplicateOfFramePosition:
        videoSlides.firstFrameDuplicateOfFramePosition,
      firstFrameSkipReason: videoSlides.firstFrameSkipReason,
      // Last frame data
      lastFrameImageUrl: videoSlides.lastFrameImageUrl,
      lastFrameIsDuplicate: videoSlides.lastFrameIsDuplicate,
      lastFrameDuplicateOfSegmentId: videoSlides.lastFrameDuplicateOfSegmentId,
      lastFrameDuplicateOfFramePosition:
        videoSlides.lastFrameDuplicateOfFramePosition,
      lastFrameSkipReason: videoSlides.lastFrameSkipReason,
    })
    .from(videoSlides)
    .where(eq(videoSlides.videoId, videoId))
    .orderBy(asc(videoSlides.slideIndex));

  // If extraction status is "in_progress" but we have slides, fix the status
  // This handles the case where extraction completed but status wasn't updated
  let status = extraction?.status ?? "idle";
  if (extraction && status === "in_progress" && slides.length > 0) {
    console.log(
      "⚙️ Found in_progress extraction with slides, marking as completed:",
      videoId,
    );
    await db
      .update(videoSlideExtractions)
      .set({
        status: "completed",
        totalSlides: slides.length,
        updatedAt: new Date(),
      })
      .where(eq(videoSlideExtractions.videoId, videoId));
    status = "completed";
  }

  // If extraction status is "completed" but we have no slides, this is a data inconsistency
  // Mark as failed so user can retry
  if (extraction && status === "completed" && slides.length === 0) {
    console.log(
      "⚙️ Found completed extraction with no slides (data inconsistency), marking as failed:",
      videoId,
    );
    await db
      .update(videoSlideExtractions)
      .set({
        status: "failed",
        errorMessage:
          "Extraction completed but no slides were saved. Please try again.",
        updatedAt: new Date(),
      })
      .where(eq(videoSlideExtractions.videoId, videoId));
    status = "failed";
  }

  // If extraction status is "in_progress" but hasn't been updated for 30+ minutes,
  // mark as failed so user can retry
  if (extraction && status === "in_progress" && slides.length === 0) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const lastUpdate = extraction.updatedAt ?? extraction.createdAt;

    if (lastUpdate < thirtyMinutesAgo) {
      console.log(
        "⚙️ Found stuck in_progress extraction (>30min old), marking as failed:",
        videoId,
      );
      await db
        .update(videoSlideExtractions)
        .set({
          status: "failed",
          errorMessage:
            "Extraction timed out or workflow failed to start. Please try again.",
          updatedAt: new Date(),
        })
        .where(eq(videoSlideExtractions.videoId, videoId));
      status = "failed";
    }
  }

  return NextResponse.json({
    status,
    runId: extraction?.runId ?? null,
    totalSlides: extraction?.totalSlides ?? slides.length,
    errorMessage: extraction?.errorMessage ?? null,
    slides: slides.map((s) => ({
      slideIndex: s.slideIndex,
      frameId: s.frameId,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      firstFrameImageUrl: s.firstFrameImageUrl,
      firstFrameIsDuplicate: s.firstFrameIsDuplicate,
      firstFrameDuplicateOfSegmentId: s.firstFrameDuplicateOfSegmentId,
      firstFrameDuplicateOfFramePosition: s.firstFrameDuplicateOfFramePosition,
      firstFrameSkipReason: s.firstFrameSkipReason,
      lastFrameImageUrl: s.lastFrameImageUrl,
      lastFrameIsDuplicate: s.lastFrameIsDuplicate,
      lastFrameDuplicateOfSegmentId: s.lastFrameDuplicateOfSegmentId,
      lastFrameDuplicateOfFramePosition: s.lastFrameDuplicateOfFramePosition,
      lastFrameSkipReason: s.lastFrameSkipReason,
    })),
  });
}

// ============================================================================
// POST - Start slide extraction
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Check if force re-extraction is requested
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  // Check for existing extraction
  const [existing] = await db
    .select()
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  // If force is not set, check for conflicts
  if (!force) {
    // If already completed, return existing data
    if (existing?.status === "completed") {
      return NextResponse.json(
        { error: "Slides already extracted", status: "completed" },
        { status: 409 },
      );
    }

    // If in progress, return conflict
    if (existing?.status === "in_progress") {
      return NextResponse.json(
        { error: "Extraction already in progress", runId: existing.runId },
        { status: 409 },
      );
    }
  }

  // If forcing re-extraction or retrying after failure, delete existing slides first
  if (force || existing?.status === "failed") {
    await db.delete(videoSlides).where(eq(videoSlides.videoId, videoId));
  }

  // Create or update extraction record
  await db
    .insert(videoSlideExtractions)
    .values({
      videoId,
      status: "in_progress",
    })
    .onConflictDoUpdate({
      target: videoSlideExtractions.videoId,
      set: {
        status: "in_progress",
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

  try {
    // Start workflow
    const run = await start(extractSlidesWorkflow, [videoId]);

    // Update with runId
    await db
      .update(videoSlideExtractions)
      .set({ runId: run.runId })
      .where(eq(videoSlideExtractions.videoId, videoId));

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    console.error("Failed to start workflow:", error);

    // FIX: Revert DB state so user can try again
    await db
      .delete(videoSlideExtractions)
      .where(eq(videoSlideExtractions.videoId, videoId));

    return NextResponse.json(
      { error: "Failed to start extraction workflow" },
      { status: 500 },
    );
  }
}
