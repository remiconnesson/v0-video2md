import { createParser } from "eventsource-parser";
import { FatalError, fetch } from "workflow";
import {
  JobStatus,
  type JobUpdate,
  type SlideStreamEvent,
} from "@/lib/slides-types";
import { emit } from "@/lib/stream-utils";
import type { YouTubeVideoId } from "@/lib/youtube-utils";
import { CONFIG } from "./config";

// ============================================================================
// Step: Trigger extraction
// ============================================================================

const TOTAL_STEPS = 4;

function resolveJobStep(status: JobStatus): number {
  switch (status) {
    case JobStatus.PENDING:
      return 1;
    case JobStatus.DOWNLOADING:
    case JobStatus.EXTRACTING:
      return 2;
    case JobStatus.UPLOADING:
    case JobStatus.COMPLETED:
    case JobStatus.FAILED:
      return 4;
    default:
      return 2;
  }
}

export async function triggerExtraction(
  videoId: YouTubeVideoId,
): Promise<void> {
  "use step";

  const extractionUrl = `${CONFIG.SLIDES_EXTRACTOR_URL}/process/youtube/${videoId}`;

  try {
    console.log(
      `📤 triggerExtraction: Triggering extraction for video ${videoId} at ${extractionUrl}`,
    );

    const response = await fetch(extractionUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
    });

    if (!response.ok) {
      const responseText = await response.text();
      const errorDetails = {
        url: extractionUrl,
        videoId,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseBody: responseText,
      };

      console.error("Trigger extraction failed:", errorDetails);

      throw new Error(
        `Failed to trigger extraction for video ${videoId}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    console.log(
      `📤 triggerExtraction: Successfully triggered extraction for video ${videoId}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to trigger extraction")
    ) {
      throw error; // Re-throw our detailed error
    }

    console.error(
      `📤 triggerExtraction: Network error triggering extraction for video ${videoId}:`,
      error,
    );
    throw new Error(
      `Network error triggering extraction for video ${videoId} at ${extractionUrl}: ` +
        `${error instanceof Error ? error.message : "Unknown network error"}`,
    );
  }
}

// ============================================================================
// Step: Check Job Status Helpers
// ============================================================================

async function fetchJobStream(videoId: YouTubeVideoId) {
  const jobStatusUrl = `${CONFIG.SLIDES_EXTRACTOR_URL}/jobs/${videoId}/stream`;
  console.log(`🔍 checkJobStatus: Checking job status for video ${videoId}`);

  const response = await fetch(jobStatusUrl, {
    headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
  });

  if (response.status === 404) {
    console.error(`🔍 checkJobStatus: Job not found for video ${videoId}`, {
      videoId,
      url: jobStatusUrl,
      status: response.status,
      statusText: response.statusText,
      errorType: "JOB_NOT_FOUND",
      timestamp: new Date().toISOString(),
    });
    throw new FatalError(
      `Job not found for video ${videoId} - job may not have been created successfully. ` +
        `URL: ${jobStatusUrl} | Status: ${response.status}`,
    );
  }

  if (!response.ok) {
    const responseText = await response.text();
    const isServerError = response.status >= 500;
    const isClientError = response.status >= 400 && response.status < 500;

    console.error(
      `🔍 checkJobStatus: Job status check failed for video ${videoId}`,
      {
        videoId,
        url: jobStatusUrl,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText.substring(0, 200), // Truncate long responses
        errorType: isServerError
          ? "SERVER_ERROR"
          : isClientError
            ? "CLIENT_ERROR"
            : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
      },
    );

    // Use FatalError for client errors (4xx) as they won't be fixed by retries
    const ErrorClass = isClientError ? FatalError : Error;

    throw new ErrorClass(
      `Failed to check job status for video ${videoId}: ` +
        `HTTP ${response.status} ${response.statusText} | ` +
        `Response: ${responseText.substring(0, 100)}... | ` +
        `URL: ${jobStatusUrl}`,
    );
  }

  return response;
}

async function processJobStream(
  response: Response,
  videoId: YouTubeVideoId,
  writable: WritableStream<SlideStreamEvent>,
): Promise<{ manifestUri: string | null; error?: string }> {
  if (!response.body) {
    throw new Error(`Job stream response for video ${videoId} has no body`);
  }

  let manifestUri: string | null = null;
  let jobError: string | null = null;
  let eventCount = 0;

  const parser = createParser({
    onEvent: (event) => {
      console.dir(event);
      if (event.data) {
        eventCount++;
        try {
          const jobUpdate: JobUpdate = JSON.parse(event.data);

          console.dir(jobUpdate, { depth: null });

          console.log(
            `🔍️ checkJobStatus: Job event ${eventCount} for video ${videoId}:`,
            {
              status: jobUpdate.status,
              progress: jobUpdate.progress,
              message: jobUpdate.message,
              hasMetadataUri: !!jobUpdate.metadata_uri,
              metadataUri: jobUpdate.metadata_uri,
            },
          );

          // Capture state
          if (
            jobUpdate.status === JobStatus.COMPLETED &&
            jobUpdate.metadata_uri
          ) {
            manifestUri = jobUpdate.metadata_uri;
            console.log(
              `🔍 checkJobStatus: Job completed for video ${videoId}, manifest URI: ${manifestUri}`,
            );
          } else if (jobUpdate.status === JobStatus.FAILED) {
            jobError = jobUpdate.error ?? "Extraction failed";
            console.error(
              `🔍 checkJobStatus: Job failed for video ${videoId}:`,
              {
                error: jobUpdate.error,
                fullUpdate: jobUpdate,
              },
            );
          }

          // Emit progress (fire and forget inside sync callback is safer in loop)
          if (!jobError && !manifestUri) {
            emit<SlideStreamEvent>(
              {
                type: "progress",
                status: jobUpdate.status,
                step: resolveJobStep(jobUpdate.status),
                totalSteps: TOTAL_STEPS,
                message: jobUpdate.message,
              },
              writable,
            );
          }
        } catch (parseError) {
          console.warn(
            `🔍 checkJobStatus: Failed to parse job event for video ${videoId}:`,
            parseError,
          );
        }
      }
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value));
      if (manifestUri || jobError) break;
    }
  } finally {
    reader.releaseLock();
  }

  console.log(
    `🔍 checkJobStatus: Stream processing complete for video ${videoId}: ${eventCount} events processed`,
  );

  if (jobError) {
    return { manifestUri: null, error: jobError };
  }

  return { manifestUri };
}

export async function checkJobStatus(
  videoId: YouTubeVideoId,
  writable: WritableStream<SlideStreamEvent>,
): Promise<{
  manifestUri: string | null;
  jobFailed: boolean;
  failureReason: string;
}> {
  "use step";

  const response = await fetchJobStream(videoId);
  const { manifestUri, error } = await processJobStream(
    response,
    videoId,
    writable,
  );

  if (error) {
    return { manifestUri: null, jobFailed: true, failureReason: error };
  }

  return { manifestUri, jobFailed: false, failureReason: "" };
}

checkJobStatus.maxRetries = 1;
