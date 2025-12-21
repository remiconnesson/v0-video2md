import { NextResponse } from "next/server";
import { isValidYouTubeVideoId } from "./youtube-utils";

/**
 * Validates a YouTube video ID and returns an error response if invalid.
 * @param videoId - The video ID to validate
 * @returns NextResponse with error if invalid, null if valid
 */
export function validateYouTubeVideoId(videoId: string): NextResponse | null {
  if (!isValidYouTubeVideoId(videoId)) {
    return NextResponse.json(
      { error: "Invalid YouTube video ID format" },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Standard headers for Server-Sent Events (SSE) responses.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

/**
 * Creates a TransformStream that converts events to SSE format.
 * @returns TransformStream that serializes events as SSE data lines
 */
export function createSSETransformStream<T>(): TransformStream<T, string> {
  return new TransformStream<T, string>({
    transform(chunk, controller) {
      controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
    },
  });
}

/**
 * Creates an SSE response from a readable stream.
 * @param readable - The readable stream of events
 * @param workflowRunId - Optional workflow run ID to include in headers
 * @returns NextResponse configured for SSE
 */
export function createSSEResponse<T>(
  readable: ReadableStream<T>,
  workflowRunId?: string,
): NextResponse {
  const transformStream = createSSETransformStream<T>();
  const sseStream = readable.pipeThrough(transformStream);

  const headers: Record<string, string> = { ...SSE_HEADERS };
  if (workflowRunId) {
    headers["X-Workflow-Run-Id"] = workflowRunId;
  }

  return new NextResponse(sseStream, { headers });
}
