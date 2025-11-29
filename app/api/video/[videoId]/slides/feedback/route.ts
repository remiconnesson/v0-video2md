import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { slideFeedback, videos } from "@/db/schema";

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
  const existing = await db
    .select({ id: slideFeedback.id })
    .from(slideFeedback)
    .where(
      and(
        eq(slideFeedback.videoId, videoId),
        eq(slideFeedback.slideIndex, feedback.slideIndex),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(slideFeedback)
      .set({
        firstFrameHasTextValidated: feedback.firstFrameHasTextValidated ?? null,
        firstFrameIsDuplicateValidated:
          feedback.firstFrameIsDuplicateValidated ?? null,
        lastFrameHasTextValidated: feedback.lastFrameHasTextValidated ?? null,
        lastFrameIsDuplicateValidated:
          feedback.lastFrameIsDuplicateValidated ?? null,
        framesSameness: feedback.framesSameness ?? null,
        updatedAt: new Date(),
      })
      .where(eq(slideFeedback.id, existing[0].id));
  } else {
    await db.insert(slideFeedback).values({
      videoId,
      slideIndex: feedback.slideIndex,
      firstFrameHasTextValidated: feedback.firstFrameHasTextValidated ?? null,
      firstFrameIsDuplicateValidated:
        feedback.firstFrameIsDuplicateValidated ?? null,
      lastFrameHasTextValidated: feedback.lastFrameHasTextValidated ?? null,
      lastFrameIsDuplicateValidated:
        feedback.lastFrameIsDuplicateValidated ?? null,
      framesSameness: feedback.framesSameness ?? null,
    });
  }

  return NextResponse.json({ success: true });
}
