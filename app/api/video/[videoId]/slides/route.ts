import { and, asc, eq, isNull } from "drizzle-orm";
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
  ctx: RouteContext<"/api/video/[videoId]/slides">,
) {
  const { videoId } = await ctx.params;

  // Get extraction status
  const [extraction] = await db
    .select()
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  // Get existing slides
  const slides = await db
    .select({
      slideNumber: videoSlides.slideNumber,
      startTime: videoSlides.startTime,
      endTime: videoSlides.endTime,
      duration: videoSlides.duration,
      // First frame data
      firstFrameImageUrl: videoSlides.firstFrameImageUrl,
      firstFrameIsDuplicate: videoSlides.firstFrameIsDuplicate,
      firstFrameDuplicateOfSlideNumber:
        videoSlides.firstFrameDuplicateOfSlideNumber,
      firstFrameDuplicateOfFramePosition:
        videoSlides.firstFrameDuplicateOfFramePosition,
      // Last frame data
      lastFrameImageUrl: videoSlides.lastFrameImageUrl,
      lastFrameIsDuplicate: videoSlides.lastFrameIsDuplicate,
      lastFrameDuplicateOfSlideNumber:
        videoSlides.lastFrameDuplicateOfSlideNumber,
      lastFrameDuplicateOfFramePosition:
        videoSlides.lastFrameDuplicateOfFramePosition,
    })
    .from(videoSlides)
    .where(eq(videoSlides.videoId, videoId))
    .orderBy(asc(videoSlides.slideNumber));

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
      })
      .where(eq(videoSlideExtractions.videoId, videoId));
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
      await db
        .update(videoSlideExtractions)
        .set({
          status: "failed",
          errorMessage:
            "Extraction timed out or workflow failed to start. Please try again.",
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
  const [existing] = await db
    .select()
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  // If already completed, return existing data
  if (existing?.status === "completed") {
    return NextResponse.json(
      { error: "Slides already extracted", status: "completed" },
      { status: 409 },
    );
  }

  // If in progress with a runId, return conflict
  // Note: We allow in_progress without runId to be retried (handles edge case of workflow start failure)
  if (existing?.status === "in_progress" && existing.runId) {
    return NextResponse.json(
      { error: "Extraction already in progress", runId: existing.runId },
      { status: 409 },
    );
  }

  // If retrying after failure, delete existing slides first
  if (existing?.status === "failed") {
    await db.delete(videoSlides).where(eq(videoSlides.videoId, videoId));
  }

  // Ensure extraction record exists (create if needed, set to pending if failed)
  // This is idempotent and safe to run by multiple concurrent requests
  await db
    .insert(videoSlideExtractions)
    .values({
      videoId,
      status: "pending", // Use pending to indicate record exists but workflow not started
    })
    .onConflictDoUpdate({
      target: videoSlideExtractions.videoId,
      set: {
        status: "pending",
        errorMessage: null,
        runId: null, // Clear any stale runId from previous failed attempts
      },
    });

  try {
    // Start workflow - this may be done by multiple concurrent requests
    const run = await start(extractSlidesWorkflow, [videoId]);

    // Atomic claim: Update with runId ONLY if runId is still NULL and status is pending
    // This ensures only ONE request wins the race and claims the workflow
    const [claimed] = await db
      .update(videoSlideExtractions)
      .set({
        runId: run.runId,
        status: "in_progress",
      })
      .where(
        and(
          eq(videoSlideExtractions.videoId, videoId),
          isNull(videoSlideExtractions.runId),
          eq(videoSlideExtractions.status, "pending"),
        ),
      )
      .returning({ runId: videoSlideExtractions.runId });

    // If we won the race (claimed is defined), return our stream
    if (claimed) {
      console.log(
        `✅ Successfully claimed workflow ${run.runId} for video ${videoId}`,
      );
      return createSSEResponse(run.readable, run.runId);
    }

    // We lost the race - another request already claimed a runId
    // Fetch the winning runId to return to the client
    console.log(
      `⚠️ Lost race for video ${videoId}, our workflow ${run.runId} will be orphaned`,
    );
    const [winner] = await db
      .select()
      .from(videoSlideExtractions)
      .where(eq(videoSlideExtractions.videoId, videoId))
      .limit(1);

    // Note: The orphaned workflow will eventually complete or timeout
    // but its results won't be stored since we don't have its runId in DB
    // This is acceptable as only one workflow result should be used

    return NextResponse.json(
      {
        error: "Extraction already in progress",
        runId: winner?.runId ?? null,
      },
      { status: 409 },
    );
  } catch (error) {
    console.error("Failed to start workflow:", error);

    // Revert DB state so user can try again
    // Only delete if we haven't claimed a runId (otherwise another request may have succeeded)
    await db
      .update(videoSlideExtractions)
      .set({
        status: "failed",
        errorMessage: "Failed to start extraction workflow",
      })
      .where(
        and(
          eq(videoSlideExtractions.videoId, videoId),
          isNull(videoSlideExtractions.runId),
        ),
      );

    return NextResponse.json(
      { error: "Failed to start extraction workflow" },
      { status: 500 },
    );
  }
}
