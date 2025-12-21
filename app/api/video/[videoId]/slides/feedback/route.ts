import { createInsertSchema } from "drizzle-zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSlideFeedback,
  upsertSlideFeedback,
  upsertSlideFeedbackBatch,
  videoExists,
} from "@/db/queries";
import { slideFeedback } from "@/db/schema";
import { errorResponse } from "@/lib/api-utils";

// ============================================================================
// Schemas
// ============================================================================

const slideFeedbackSchema = createInsertSchema(slideFeedback).omit({
  id: true,
  videoId: true,
  createdAt: true,
});
const slideFeedbackBatchSchema = z.array(slideFeedbackSchema);

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
    return errorResponse("Video not found", 404);
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
    return errorResponse("Video not found", 404);
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = Array.isArray(body)
    ? slideFeedbackBatchSchema.safeParse(body)
    : slideFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Validation failed", 400, {
      details: parsed.error.format(),
    });
  }

  const feedback = parsed.data;

  // Upsert slide feedback
  if (Array.isArray(feedback)) {
    await upsertSlideFeedbackBatch(videoId, feedback);
  } else {
    await upsertSlideFeedback(videoId, feedback);
  }

  return NextResponse.json({
    success: true,
    updatedCount: Array.isArray(feedback) ? feedback.length : 1,
  });
}
