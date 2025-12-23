import { createParser, type ParseEvent } from "eventsource-parser";
import { FatalError, fetch } from "workflow";
import {
  JobStatus,
  type JobUpdate,
  type SlideStreamEvent,
} from "@/lib/slides-types";
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

async function fetchJobStream(videoId: YouTubeVideoId): Promise<Response> {
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

async function monitorJobProgress(
  response: Response,
  videoId: YouTubeVideoId,
  writable: WritableStream<SlideStreamEvent>,
): Promise<{
  manifestUri: string | null;
  jobFailed: boolean;
  failureReason: string;
}> {
  let manifestUri: string | null = null;
  let jobFailed = false;
  let failureReason = "";
  let eventCount = 0;

  if (!response.body) {
    return { manifestUri, jobFailed, failureReason };
  }

  const writer = writable.getWriter();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // We need to capture events from the parser callback
  const pendingEvents: ParseEvent[] = [];
  const parser = createParser({
    onEvent: (event) => {
      pendingEvents.push(event);
    },
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      parser.feed(decoder.decode(value, { stream: true }));

      // Process all events generated by this chunk
      while (pendingEvents.length > 0) {
        const event = pendingEvents.shift();
        if (!event || !event.data) continue;

        console.dir(event); // Original code logged the event
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
              }
              if (jobUpdate.status === JobStatus.FAILED) {
                jobFailed = true;
                failureReason = jobUpdate.error ?? "Extraction failed";
                console.error(
                  `🔍 checkJobStatus: Job failed for video ${videoId}:`,
                  {
                    error: jobUpdate.error,
                    fullUpdate: jobUpdate,
                  },
                );
              }

              // Write progress
              if (!jobFailed && !manifestUri) {
                await writer.write({
                    type: "progress",
                    status: jobUpdate.status,
                    step: resolveJobStep(jobUpdate.status),
                    totalSteps: TOTAL_STEPS,
                    message: jobUpdate.message,
                  });
              }
            } catch (parseError) {
              console.warn(
                `🔍 checkJobStatus: Failed to parse job event for video ${videoId}:`,
                parseError,
              );
            }
          }

        // Check if we reached a terminal state
        if (manifestUri || jobFailed) break;
      }

      if (manifestUri || jobFailed) break;
    }

    console.log(
      `🔍 checkJobStatus: Stream processing complete for video ${videoId}: ${eventCount} events processed`,
    );
  } finally {
    writer.releaseLock();
  }

  return { manifestUri, jobFailed, failureReason };
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
  return monitorJobProgress(response, videoId, writable);
}

checkJobStatus.maxRetries = 1;
