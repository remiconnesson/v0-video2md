import { and, asc, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { chapterSchema } from "@/ai/transcript-to-book-schema";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import { db } from "@/db";
import { videoSlideExtractions, videoSlides } from "@/db/schema";
import type { SlideStreamEvent } from "@/lib/slides-extractor-types";

const chaptersPayloadSchema = z.object({
  chapters: z.array(chapterSchema).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Get extraction status
  const extraction = await db
    .select()
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  // Get existing slides
  const slides = await db
    .select()
    .from(videoSlides)
    .where(eq(videoSlides.videoId, videoId))
    .orderBy(asc(videoSlides.slideIndex));

  const extractionRecord = extraction[0];

  return NextResponse.json({
    status: extractionRecord?.status ?? "idle",
    runId: extractionRecord?.runId ?? null,
    totalSlides: extractionRecord?.totalSlides ?? 0,
    slides: slides.map((s) => ({
      slide_index: s.slideIndex,
      chapter_index: s.chapterIndex,
      frame_id: s.frameId,
      start_time: s.startTime,
      end_time: s.endTime,
      image_url: s.imageUrl,
      has_text: s.hasText,
      text_confidence: (s.textConfidence ?? 0) / 100,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chaptersPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { chapters } = parsed.data;

  try {
    // Check if an extraction is already in progress for this video
    const existingExtraction = await db
      .select()
      .from(videoSlideExtractions)
      .where(eq(videoSlideExtractions.videoId, videoId))
      .limit(1);

    if (
      existingExtraction.length > 0 &&
      existingExtraction[0].status === "in_progress"
    ) {
      return NextResponse.json(
        {
          error: "Extraction already in progress",
          runId: existingExtraction[0].runId,
          message: "An extraction is already running for this video",
        },
        { status: 409 },
      );
    }

    // Create/update extraction record BEFORE starting the workflow
    // to avoid race conditions where a fast workflow completes before this runs.
    await db
      .insert(videoSlideExtractions)
      .values({
        videoId,
        runId: null,
        status: "in_progress",
        totalSlides: 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: videoSlideExtractions.videoId,
        set: {
          status: "in_progress",
          totalSlides: 0,
          updatedAt: new Date(),
        },
      });

    // Start the workflow
    const run = await start(extractSlidesWorkflow, [videoId, chapters]);

    // Update the runId, but only if status is still "in_progress"
    // (in case the workflow already completed)
    await db
      .update(videoSlideExtractions)
      .set({
        runId: run.runId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videoSlideExtractions.videoId, videoId),
          ne(videoSlideExtractions.status, "completed"),
        ),
      );

    // Transform the object stream to SSE-formatted text stream
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
    console.error("Failed to start slides extraction:", error);

    // Mark as failed if there was an error starting the workflow
    await db
      .update(videoSlideExtractions)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(videoSlideExtractions.videoId, videoId));

    return NextResponse.json(
      { error: "Failed to start slide extraction" },
      { status: 500 },
    );
  }
}
