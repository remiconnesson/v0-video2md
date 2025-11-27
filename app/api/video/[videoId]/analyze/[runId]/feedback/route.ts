import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { runFeedback, sectionFeedback, videoAnalysisRuns } from "@/db/schema";

// ============================================================================
// Schemas
// ============================================================================

const sectionFeedbackSchema = z.object({
  type: z.literal("section"),
  sectionKey: z.string().min(1),
  rating: z.enum(["useful", "not_useful"]).optional(),
  comment: z.string().optional(),
});

const overallFeedbackSchema = z.object({
  type: z.literal("overall"),
  overallRating: z.number().min(1).max(5),
});

const feedbackSchema = z.discriminatedUnion("type", [
  sectionFeedbackSchema,
  overallFeedbackSchema,
]);

// ============================================================================
// GET - Get all feedback for a run
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { runId } = await params;
  const runIdNum = parseInt(runId, 10);

  if (Number.isNaN(runIdNum)) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  const [sections, overall] = await Promise.all([
    db
      .select()
      .from(sectionFeedback)
      .where(eq(sectionFeedback.runId, runIdNum)),
    db.select().from(runFeedback).where(eq(runFeedback.runId, runIdNum)),
  ]);

  return NextResponse.json({
    sections,
    overall: overall[0] ?? null,
  });
}

// ============================================================================
// POST - Submit feedback
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { videoId, runId } = await params;
  const runIdNum = parseInt(runId, 10);

  if (Number.isNaN(runIdNum)) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  // Verify run exists and belongs to video
  const [run] = await db
    .select({ id: videoAnalysisRuns.id, videoId: videoAnalysisRuns.videoId })
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.id, runIdNum))
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.videoId !== videoId) {
    return NextResponse.json(
      { error: "Run does not belong to this video" },
      { status: 403 },
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const feedback = parsed.data;

  if (feedback.type === "section") {
    // Upsert section feedback
    const existing = await db
      .select({ id: sectionFeedback.id })
      .from(sectionFeedback)
      .where(
        and(
          eq(sectionFeedback.runId, runIdNum),
          eq(sectionFeedback.sectionKey, feedback.sectionKey),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(sectionFeedback)
        .set({
          rating: feedback.rating ?? null,
          comment: feedback.comment ?? null,
        })
        .where(eq(sectionFeedback.id, existing[0].id));
    } else {
      await db.insert(sectionFeedback).values({
        runId: runIdNum,
        sectionKey: feedback.sectionKey,
        rating: feedback.rating ?? null,
        comment: feedback.comment ?? null,
      });
    }

    return NextResponse.json({ success: true, type: "section" });
  }

  // Overall feedback - upsert
  const existingOverall = await db
    .select({ id: runFeedback.id })
    .from(runFeedback)
    .where(eq(runFeedback.runId, runIdNum))
    .limit(1);

  if (existingOverall.length > 0) {
    await db
      .update(runFeedback)
      .set({ overallRating: feedback.overallRating })
      .where(eq(runFeedback.id, existingOverall[0].id));
  } else {
    await db.insert(runFeedback).values({
      runId: runIdNum,
      overallRating: feedback.overallRating,
    });
  }

  return NextResponse.json({ success: true, type: "overall" });
}
