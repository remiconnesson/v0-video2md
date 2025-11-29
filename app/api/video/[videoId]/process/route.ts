import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getRun, start } from "workflow/api";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { dynamicAnalysisWorkflow } from "@/app/workflows/dynamic-analysis";
import { extractSlidesWorkflow } from "@/app/workflows/extract-slides";
import {
  fetchTranscriptWorkflow,
  type TranscriptStreamEvent,
} from "@/app/workflows/fetch-transcript";
import { db } from "@/db";
import { videoSlideExtractions } from "@/db/schema";
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

    onEvent?.(value);

    const payload = { source, ...(value as object) } as AnyStreamEvent;
    await writer.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

async function startSlidesWorkflow(videoId: string) {
  // Avoid starting a duplicate slide extraction if one already exists
  const [existing] = await db
    .select({
      status: videoSlideExtractions.status,
      runId: videoSlideExtractions.runId,
    })
    .from(videoSlideExtractions)
    .where(eq(videoSlideExtractions.videoId, videoId))
    .limit(1);

  if (existing?.status === "in_progress" || existing?.status === "completed") {
    return existing.runId
      ? { runId: existing.runId, readable: getRun(existing.runId).readable }
      : null;
  }

  await db
    .insert(videoSlideExtractions)
    .values({
      videoId,
      status: "in_progress",
    })
    .onConflictDoUpdate({
      target: videoSlideExtractions.videoId,
      set: {
        status: "in_progress",
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

  const run = await start(extractSlidesWorkflow, [videoId]);

  await db
    .update(videoSlideExtractions)
    .set({ runId: run.runId })
    .where(eq(videoSlideExtractions.videoId, videoId));

  return run;
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
    const slidesRun = await startSlidesWorkflow(videoId);

    // Send meta event so the frontend can resume slide streams if needed
    await writer.write(
      `data: ${JSON.stringify({ source: "meta", slidesRunId: slidesRun?.runId ?? null })}\n\n`,
    );

    // Start transcript workflow first
    const transcriptRun = await start(fetchTranscriptWorkflow, [videoId]);

    const streamPromises: Promise<void>[] = [];
    let analysisStarted = false;
    let analysisPromise: Promise<void> | null = null;

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

    if (slidesRun) {
      streamPromises.push(streamWorkflow(slidesRun.readable, "slides", writer));
    }

    Promise.all(streamPromises).finally(() => {
      // Close the stream once the concatenated workflow has finished
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
