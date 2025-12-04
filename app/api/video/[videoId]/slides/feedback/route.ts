import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { slideFeedback, videoSlides, videos } from "@/db/schema";

// ============================================================================
// Schemas
// ============================================================================

const slideFeedbackSchema = z.object({
  slideIndex: z.number().int().min(0),
  firstFrameHasTextValidated: z.boolean().nullable().optional(),
  firstFrameIsDuplicateValidated: z.boolean().nullable().optional(),
  lastFrameHasTextValidated: z.boolean().nullable().optional(),
  lastFrameIsDuplicateValidated: z.boolean().nullable().optional(),
  framesSameness: z.enum(["same", "different"]).nullable().optional(),
  isFirstFramePicked: z.boolean().nullable().optional(),
  isLastFramePicked: z.boolean().nullable().optional(),
});

// ============================================================================
// GET - Get all slide feedback for a video
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Verify video exists
  const [video] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const feedback = await db
    .select()
    .from(slideFeedback)
    .where(eq(slideFeedback.videoId, videoId));

  return NextResponse.json({ feedback });
}

// ============================================================================
// POST - Submit or update slide feedback
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Verify video exists
  const [video] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = slideFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const feedback = parsed.data;

  // Upsert slide feedback
  await db
    .insert(slideFeedback)
    .values({
      videoId,
      slideIndex: feedback.slideIndex,
      firstFrameHasTextValidated: feedback.firstFrameHasTextValidated ?? null,
      firstFrameIsDuplicateValidated:
        feedback.firstFrameIsDuplicateValidated ?? null,
      lastFrameHasTextValidated: feedback.lastFrameHasTextValidated ?? null,
      lastFrameIsDuplicateValidated:
        feedback.lastFrameIsDuplicateValidated ?? null,
      framesSameness: feedback.framesSameness ?? null,
      isFirstFramePicked: feedback.isFirstFramePicked ?? true,
      isLastFramePicked: feedback.isLastFramePicked ?? false,
    })
    .onConflictDoUpdate({
      target: [slideFeedback.videoId, slideFeedback.slideIndex],
      set: {
        firstFrameHasTextValidated: feedback.firstFrameHasTextValidated ?? null,
        firstFrameIsDuplicateValidated:
          feedback.firstFrameIsDuplicateValidated ?? null,
        lastFrameHasTextValidated: feedback.lastFrameHasTextValidated ?? null,
        lastFrameIsDuplicateValidated:
          feedback.lastFrameIsDuplicateValidated ?? null,
        framesSameness: feedback.framesSameness ?? null,
        isFirstFramePicked: feedback.isFirstFramePicked ?? true,
        isLastFramePicked: feedback.isLastFramePicked ?? false,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
}

// ============================================================================
// PATCH - Reset only isPicked fields for all slide feedback
// ============================================================================

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Verify video exists
  const [video] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Get all slides for this video to calculate defaults
  const allSlides = await db
    .select()
    .from(videoSlides)
    .where(eq(videoSlides.videoId, videoId));

  // Get all feedback for this video
  const allFeedback = await db
    .select()
    .from(slideFeedback)
    .where(eq(slideFeedback.videoId, videoId));

  // Create a map of slideIndex to slide data for quick lookup
  const slideMap = new Map(
    allSlides.map((slide) => [slide.slideIndex, slide]),
  );

  // Build update promises for parallel execution
  const updatePromises = allFeedback.map((feedback) => {
    const slide = slideMap.get(feedback.slideIndex);
    if (!slide) return Promise.resolve();

    // Calculate defaults: only pick if not skipped and not duplicate
    const defaultIsFirstFramePicked =
      !slide.firstFrameSkipReason && !slide.firstFrameIsDuplicate;
    const defaultIsLastFramePicked =
      !slide.lastFrameSkipReason && !slide.lastFrameIsDuplicate;

    return db
      .update(slideFeedback)
      .set({
        isFirstFramePicked: defaultIsFirstFramePicked,
        isLastFramePicked: defaultIsLastFramePicked,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(slideFeedback.videoId, videoId),
          eq(slideFeedback.slideIndex, feedback.slideIndex),
        ),
      );
  });

  await Promise.all(updatePromises);

  return NextResponse.json({ success: true });
}
