import { NextResponse } from "next/server";
import { start } from "workflow/api";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { dynamicAnalysisWorkflow } from "@/app/workflows/dynamic-analysis";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import {
  fetchTranscriptWorkflow,
  type TranscriptStreamEvent,
} from "@/app/workflows/fetch-transcript";
import type { SlideStreamEvent } from "@/lib/slides-types";

type AnyStreamEvent =
  | (TranscriptStreamEvent & { source: "transcript" })
  | (AnalysisStreamEvent & { source: "analysis" })
  | (SlideStreamEvent & { source: "slides" })
  | { source: "meta"; slidesRunId?: string | number | null };

async function streamWorkflow<
  T extends TranscriptStreamEvent | AnalysisStreamEvent | SlideStreamEvent,
>(
  readable: ReadableStream<T>,
  source: AnyStreamEvent["source"],
  writer: WritableStreamDefaultWriter<string>,
  onEvent?: (event: T) => void,
) {
  const reader = readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;

    await onEvent?.(value);

    // Safety: ensure we are spreading an object
    const eventData =
      typeof value === "object" && value !== null ? value : { data: value };

    const payload = { source, ...eventData } as AnyStreamEvent;
    await writer.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: "Invalid YouTube video ID format" },
      { status: 400 },
    );
  }

  const stream = new TransformStream<string, string>();
  const writer = stream.writable.getWriter();

  try {
    // 1. Start Slide Extraction (Path B)
    // We always start a new workflow. The Python service handles deduplication.
    // We don't track the runId in the DB anymore for locking purposes.
    const slidesRun = await start(extractSlidesWorkflow, [videoId]);

    // Send meta event immediately so frontend knows extraction "started"
    await writer.write(
      `data: ${JSON.stringify({ source: "meta", slidesRunId: slidesRun.runId })}\n\n`,
    );

    // 2. Start Transcript Fetching (Path A)
    const transcriptRun = await start(fetchTranscriptWorkflow, [videoId]);

    const streamPromises: Promise<void>[] = [];
    let analysisStarted = false;
    let analysisPromise: Promise<void> | null = null;

    // Stream Transcript -> then trigger Analysis
    const transcriptPromise = streamWorkflow(
      transcriptRun.readable,
      "transcript",
      writer,
      async (event) => {
        if (event.type === "complete" && !analysisStarted) {
          analysisStarted = true;
          const analysisRun = await start(dynamicAnalysisWorkflow, [videoId]);
          analysisPromise = streamWorkflow(
            analysisRun.readable,
            "analysis",
            writer,
          );
          streamPromises.push(analysisPromise);
        }
      },
    );

    streamPromises.push(transcriptPromise);

    // Stream Slides
    streamPromises.push(streamWorkflow(slidesRun.readable, "slides", writer));

    // Wait for all active streams to finish
    Promise.all(streamPromises).finally(() => {
      writer.close();
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
