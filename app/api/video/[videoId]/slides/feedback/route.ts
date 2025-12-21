import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { slideFeedback, videos } from "@/db/schema";
import { errorResponse } from "@/lib/api-utils";

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
  const [video] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  if (!video) {
    return errorResponse("Video not found", 404);
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
  ctx: RouteContext<"/api/video/[videoId]/slides/feedback">,
) {
  const { videoId } = await ctx.params;

  // Verify video exists
  const [video] = await db
    .select({ videoId: videos.videoId })
    .from(videos)
    .where(eq(videos.videoId, videoId))
    .limit(1);

  if (!video) {
    return errorResponse("Video not found", 404);
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = slideFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Validation failed", 400, {
      details: parsed.error.format(),
    });
  }

  const feedback = parsed.data;

  // Upsert slide feedback
  await db
    .insert(slideFeedback)
    .values({
      videoId,
      ...feedback,
    })
    .onConflictDoUpdate({
      target: [slideFeedback.videoId, slideFeedback.slideNumber],
      set: {
        ...feedback,
      },
    });

  return NextResponse.json({ success: true });
}
