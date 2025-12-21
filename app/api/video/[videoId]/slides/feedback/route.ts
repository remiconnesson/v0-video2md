import { createInsertSchema } from "drizzle-zod";
import { NextResponse } from "next/server";
import {
  getSlideFeedback,
  upsertSlideFeedback,
  videoExists,
} from "@/db/queries";
import { slideFeedback } from "@/db/schema";

// ============================================================================
// Schemas
// ============================================================================

const slideFeedbackSchema = createInsertSchema(slideFeedback).omit({
  id: true,
  videoId: true,
  createdAt: true,
});

// ============================================================================
// GET - Get all slide feedback for a video
// ============================================================================

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides/feedback">,
) {
  const { videoId } = await ctx.params;

  // Verify video exists
  if (!(await videoExists(videoId))) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const feedback = await getSlideFeedback(videoId);

  return NextResponse.json({ feedback });
}

// ============================================================================
// POST - Submit or update slide feedback
// ============================================================================

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides/feedback">,
) {
  const { videoId } = await ctx.params;

  // Verify video exists
  if (!(await videoExists(videoId))) {
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
  await upsertSlideFeedback(videoId, feedback);

  return NextResponse.json({ success: true });
}
