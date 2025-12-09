import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import {
  fetchAndAnalyzeWorkflow,
  type UnifiedStreamEvent,
} from "@/app/workflows/fetch-and-analyze";
import { validateYouTubeVideoId } from "@/lib/api-utils";
import type { SlideStreamEvent } from "@/lib/slides-types";

export type ProcessingStreamEvent =
  | (UnifiedStreamEvent & { source: "unified" })
  | (SlideStreamEvent & { source: "slides" });

async function streamWorkflow<T extends UnifiedStreamEvent | SlideStreamEvent>(
  readable: ReadableStream<T>,
  source: ProcessingStreamEvent["source"],
  writer: WritableStreamDefaultWriter<string>,
) {
  const reader = readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;

    // Safety: ensure we are spreading an object
    const eventData =
      typeof value === "object" && value !== null ? value : { data: value };

    const payload = { source, ...eventData } as ProcessingStreamEvent;
    await writer.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

  const stream = new TransformStream<string, string>();
  const writer = stream.writable.getWriter();

  try {
    // Start both workflows in parallel
    const [unifiedRun, slidesRun] = await Promise.all([
      start(fetchAndAnalyzeWorkflow, [videoId]),
      start(extractSlidesWorkflow, [videoId]),
    ]);

    // Stream both workflows in parallel
    const streamPromises = [
      streamWorkflow(unifiedRun.readable, "unified", writer),
      streamWorkflow(slidesRun.readable, "slides", writer),
    ];

    (async () => {
      await Promise.all(streamPromises);
      writer.close();
    })().catch((error) => {
      console.error("Stream processing error:", error);
      writer.abort(error);
    });
  } catch (error) {
    console.error("Failed to start processing workflow:", error);
    writer.abort(error);
    return NextResponse.json(
      { error: "Failed to start processing workflow" },
      { status: 500 },
    );
  }

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
