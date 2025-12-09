import { createParser } from "eventsource-parser";
import { FatalError, fetch } from "workflow";
import { JobStatus, type JobUpdate } from "@/lib/slides-types";
import { CONFIG } from "./config";

// ============================================================================
// Step: Trigger extraction
// ============================================================================

export async function triggerExtraction(videoId: string): Promise<void> {
  "use step";

  const url = `${CONFIG.SLIDES_EXTRACTOR_URL}/process/youtube/${videoId}`;

  try {
    console.log(
      `📤 triggerExtraction: Triggering extraction for video ${videoId} at ${url}`,
    );

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
    });

    if (!response.ok) {
      const responseText = await response.text();
      const errorDetails = {
        url,
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
      `Network error triggering extraction for video ${videoId} at ${url}: ` +
        `${error instanceof Error ? error.message : "Unknown network error"}`,
    );
  }
}

// ============================================================================
// Step: Check job status (single attempt)
// ============================================================================

export async function checkJobStatus(videoId: string): Promise<{
  manifestUri: string | null;
  jobFailed: boolean;
  failureReason: string;
}> {
  "use step";

  const url = `${CONFIG.SLIDES_EXTRACTOR_URL}/jobs/${videoId}/stream`;
  let manifestUri: string | null = null;
  let jobFailed = false;
  let failureReason = "";

  console.log(`🔍 checkJobStatus: Checking job status for video ${videoId}`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${CONFIG.SLIDES_API_PASSWORD}` },
  });

  if (response.status === 404) {
    console.error(`🔍 checkJobStatus: Job not found for video ${videoId}`, {
      videoId,
      url,
      status: response.status,
      statusText: response.statusText,
      errorType: "JOB_NOT_FOUND",
      timestamp: new Date().toISOString(),
    });
    throw new FatalError(
      `Job not found for video ${videoId} - job may not have been created successfully. ` +
        `URL: ${url} | Status: ${response.status}`,
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
        url,
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
        `URL: ${url}`,
    );
  }

  if (response.ok && response.body) {
    let eventCount = 0;
    const parser = createParser({
      onEvent: (event) => {
        console.dir(event);
        if (event.data) {
          eventCount++;
          try {
            const update: JobUpdate = JSON.parse(event.data);

            console.dir(update, { depth: null });

            console.log(
              `🔍️ checkJobStatus: Job event ${eventCount} for video ${videoId}:`,
              {
                status: update.status,
                progress: update.progress,
                message: update.message,
                hasMetadataUri: !!update.metadata_uri,
                metadataUri: update.metadata_uri,
              },
            );

            // Capture state
            if (update.status === JobStatus.COMPLETED && update.metadata_uri) {
              manifestUri = update.metadata_uri;
              console.log(
                `🔍 checkJobStatus: Job completed for video ${videoId}, manifest URI: ${manifestUri}`,
              );
            }
            if (update.status === JobStatus.FAILED) {
              jobFailed = true;
              failureReason = update.error ?? "Extraction failed";
              console.error(
                `🔍 checkJobStatus: Job failed for video ${videoId}:`,
                {
                  error: update.error,
                  fullUpdate: update,
                },
              );
            }

            // Emit progress (fire and forget inside sync callback is safer in loop)
            if (!jobFailed && !manifestUri) {
              // Import emitProgress dynamically to avoid circular dependency
              import("./stream-emitters").then(({ emitProgress }) =>
                emitProgress(
                  update.status,
                  update.progress,
                  update.message,
                ).catch(() => {}),
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value));
      if (manifestUri || jobFailed) break;
    }

    console.log(
      `🔍 checkJobStatus: Stream processing complete for video ${videoId}: ${eventCount} events processed`,
    );
  }

  return { manifestUri, jobFailed, failureReason };
}

checkJobStatus.maxRetries = 1;

// ============================================================================
// Workflow: Monitor job progress (Fast Failure with Detailed Info)
// ============================================================================

export async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";
  const result = await checkJobStatus(videoId);
  if (result.manifestUri) {
    return result.manifestUri;
  } else {
    throw new FatalError(
      `no manifest uri found: ${JSON.stringify(result, null, 2)}`,
    );
  }
}
