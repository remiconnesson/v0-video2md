import { NextResponse } from "next/server";

/**
 * YouTube video ID format: exactly 11 characters of [a-zA-Z0-9_-]
 */
const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Validates a YouTube video ID format.
 * @param videoId - The video ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidYouTubeVideoId(videoId: string): boolean {
  return YOUTUBE_VIDEO_ID_REGEX.test(videoId);
}

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

/**
 * Resumes a workflow stream and returns it as an SSE response.
 * This is used to reconnect to an in-progress workflow.
 * @param getRun - Function to get the workflow run
 * @param workflowRunId - The workflow run ID to resume
 * @param startIndex - Optional index to start reading from
 * @returns NextResponse with SSE stream
 */
export function resumeWorkflowStream<T>(
  getRun: (runId: string) => {
    getReadable: (opts?: { startIndex?: number }) => ReadableStream<T>;
  },
  workflowRunId: string,
  startIndex = 0,
): NextResponse {
  try {
    const run = getRun(workflowRunId);
    const readable = run.getReadable({ startIndex });

    return createSSEResponse(readable, workflowRunId);
  } catch (error) {
    console.error("Failed to resume workflow stream:", error);
    return NextResponse.json(
      { error: "Failed to resume stream" },
      { status: 500 },
    );
  }
}
