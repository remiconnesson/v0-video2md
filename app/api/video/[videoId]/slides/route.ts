import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import { db } from "@/db";
import { videoSlideExtractions, videoSlides } from "@/db/schema";
import type { SlideStreamEvent } from "@/lib/slides-types";

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
      firstFrameHasText: videoSlides.firstFrameHasText,
      firstFrameTextConfidence: videoSlides.firstFrameTextConfidence,
      firstFrameIsDuplicate: videoSlides.firstFrameIsDuplicate,
      firstFrameSkipReason: videoSlides.firstFrameSkipReason,
      // Last frame data
      lastFrameImageUrl: videoSlides.lastFrameImageUrl,
      lastFrameHasText: videoSlides.lastFrameHasText,
      lastFrameTextConfidence: videoSlides.lastFrameTextConfidence,
      lastFrameIsDuplicate: videoSlides.lastFrameIsDuplicate,
      lastFrameSkipReason: videoSlides.lastFrameSkipReason,
    })
    .from(videoSlides)
    .where(eq(videoSlides.videoId, videoId))
    .orderBy(asc(videoSlides.slideIndex));

  return NextResponse.json({
    status: extraction?.status ?? "idle",
    runId: extraction?.runId ?? null,
    totalSlides: extraction?.totalSlides ?? slides.length,
    slides: slides.map((s) => ({
      slideIndex: s.slideIndex,
      frameId: s.frameId,
      startTime: s.startTime,
      endTime: s.endTime,
      duration: s.duration,
      firstFrameImageUrl: s.firstFrameImageUrl,
      firstFrameHasText: s.firstFrameHasText,
      firstFrameTextConfidence: s.firstFrameTextConfidence,
      firstFrameIsDuplicate: s.firstFrameIsDuplicate,
      firstFrameSkipReason: s.firstFrameSkipReason,
      lastFrameImageUrl: s.lastFrameImageUrl,
      lastFrameHasText: s.lastFrameHasText,
      lastFrameTextConfidence: s.lastFrameTextConfidence,
      lastFrameIsDuplicate: s.lastFrameIsDuplicate,
      lastFrameSkipReason: s.lastFrameSkipReason,
    })),
  });
}

// ============================================================================
// POST - Start slide extraction
// ============================================================================

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Check for existing extraction
  const [existing] = await db
    .select()
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  // TODO: This part is problematic, because it can return in progress but it's not actually in progress the job is stuck because the workflow didn't start.

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

    // Transform to SSE
    const transformStream = new TransformStream<SlideStreamEvent, string>({
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
