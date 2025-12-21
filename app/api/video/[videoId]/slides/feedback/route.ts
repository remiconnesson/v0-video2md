import { createInsertSchema } from "drizzle-zod"
import { NextResponse } from "next/server"
import type { RouteContext } from "next/dist/server/app-router"
import { getSlideFeedback, upsertSlideFeedback, videoExists } from "@/db/queries"
import { slideFeedback } from "@/db/schema"
import { errorResponse } from "@/lib/api-utils"

// ============================================================================
// Schemas
// ============================================================================

const slideFeedbackSchema = createInsertSchema(slideFeedback).omit({
  id: true,
  videoId: true,
  createdAt: true,
})

// ============================================================================
// GET - Get all slide feedback for a video
// ============================================================================

export async function GET(_request: Request, ctx: RouteContext<"/api/video/[videoId]/slides/feedback">) {
  const { videoId } = ctx.params

  // Verify video exists
  if (!(await videoExists(videoId))) {
    return errorResponse("Video not found", 404)
  }

  const feedback = await getSlideFeedback(videoId)

  return NextResponse.json({ feedback })
}

// ============================================================================
// POST - Submit or update slide feedback
// ============================================================================

export async function POST(request: Request, ctx: RouteContext<"/api/video/[videoId]/slides/feedback">) {
  const { videoId } = ctx.params

  // Verify video exists
  if (!(await videoExists(videoId))) {
    return errorResponse("Video not found", 404)
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Invalid JSON body", 400)
  }

  const parsed = slideFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse("Validation failed", 400, {
      details: parsed.error.format(),
    })
  }

  const feedback = parsed.data

  // Upsert slide feedback
  await upsertSlideFeedback(videoId, feedback)

  return NextResponse.json({ success: true })
}
