import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";
import { chapterSchema } from "@/ai/transcript-to-book-schema";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import type { SlideStreamEvent } from "@/lib/slides-extractor-types";

const chaptersPayloadSchema = z.object({
  chapters: z.array(chapterSchema).optional(),
});

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
    const run = await start(extractSlidesWorkflow, [videoId, chapters]);

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
    return NextResponse.json(
      { error: "Failed to start slide extraction" },
      { status: 500 },
    );
  }
}
