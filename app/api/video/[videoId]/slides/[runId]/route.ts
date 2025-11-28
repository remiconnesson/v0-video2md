import { NextResponse } from "next/server";
import { getRun } from "workflow/api";
import type { SlideStreamEvent } from "@/lib/slides-types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { runId } = await params;
  const url = new URL(request.url);
  const startIndex = url.searchParams.get("startIndex");

  const run = getRun(runId);
  const stream = run.getReadable({
    startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
  });

  const transformStream = new TransformStream<SlideStreamEvent, string>({
    transform(chunk, controller) {
      controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
    },
  });

  return new NextResponse(stream.pipeThrough(transformStream), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
