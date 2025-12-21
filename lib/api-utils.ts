import { NextResponse } from "next/server";
import { isValidYouTubeVideoId } from "./youtube-utils";

/**
 * Standard error response format for API routes.
 */
export interface ApiErrorResponse {
  error: string;
  status?: number;
  details?: unknown;
  code?: string;
  context?: Record<string, unknown>;
}

/**
 * Creates a standardized error response.
 * @param message - Error message
 * @param status - HTTP status code (default: 400)
 * @param options - Additional error context
 * @returns NextResponse with standardized error format
 */
export function errorResponse(
  message: string,
  status = 400,
  options?: {
    details?: unknown;
    code?: string;
    context?: Record<string, unknown>;
  },
): NextResponse {
  const responseBody: ApiErrorResponse = { error: message };

  if (options?.details) {
    responseBody.details = options.details;
  }

  if (options?.code) {
    responseBody.code = options.code;
  }

  if (options?.context && Object.keys(options.context).length > 0) {
    responseBody.context = options.context;
  }

  return NextResponse.json(responseBody, { status });
}

/**
 * Standardized error logging helper.
 */
export function logError(
  error: unknown,
  context: string,
  additionalData?: Record<string, unknown>,
): void {
  console.error(`[ERROR] ${context}:`, error);
  if (additionalData) {
    console.error("Additional context:", additionalData);
  }
}

/**
 * Validates a YouTube video ID and returns an error response if invalid.
 * @param videoId - The video ID to validate
 * @returns NextResponse with error if invalid, null if valid
 */
export function validateYouTubeVideoId(videoId: string): NextResponse | null {
  if (!isValidYouTubeVideoId(videoId)) {
    return errorResponse("Invalid YouTube video ID format", 400, {
      context: { videoId },
    });
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
 * Interface for workflow runs that can be resumed
 */
export interface ResumableWorkflowRun<T> {
  getReadable: (opts?: { startIndex?: number }) => ReadableStream<T>;
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
  getRun: (runId: string) => ResumableWorkflowRun<T>,
  workflowRunId: string,
  startIndex = 0,
): NextResponse {
  try {
    const run = getRun(workflowRunId);
    const readable = run.getReadable({ startIndex });

    return createSSEResponse(readable, workflowRunId);
  } catch (error) {
    logError(error, "Failed to resume workflow stream", { workflowRunId });
    return errorResponse("Failed to resume stream", 500);
  }
}
