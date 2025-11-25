// lib/slides-extractor-client.ts

import { AwsClient } from "aws4fetch";
import { createParser } from "eventsource-parser";
import type {
  JobUpdate,
  SlideManifest,
  StaticSegment,
} from "./slides-extractor-types";

const CONFIG = {
  API_BASE:
    process.env.SLIDES_API_BASE || "https://slides-extractor.remtoolz.ai",
  S3_BASE: process.env.S3_BASE_URL || "https://s3.remtoolz.ai",
  API_PASSWORD: process.env.SLIDES_API_PASSWORD!,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY!,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY!,
  S3_REGION: process.env.S3_REGION || "us-east-1",
};

// Lazy-initialize S3 client
let _s3Client: AwsClient | null = null;
function getS3Client(): AwsClient {
  if (!_s3Client) {
    _s3Client = new AwsClient({
      accessKeyId: CONFIG.S3_ACCESS_KEY,
      secretAccessKey: CONFIG.S3_SECRET_KEY,
      service: "s3",
      region: CONFIG.S3_REGION,
    });
  }
  return _s3Client;
}

export class SlidesExtractorClient {
  /**
   * Trigger the background job for video processing
   */
  async triggerJob(videoId: string): Promise<void> {
    const res = await fetch(`${CONFIG.API_BASE}/process/youtube/${videoId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.API_PASSWORD}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to trigger job: ${res.status} - ${text}`);
    }
  }

  /**
   * Stream job updates via SSE
   * Yields JobUpdate objects as they arrive
   */
  async *streamJobUpdates(videoId: string): AsyncGenerator<JobUpdate> {
    const streamUrl = `${CONFIG.API_BASE}/jobs/${videoId}/stream`;

    const response = await fetch(streamUrl, {
      headers: { Authorization: `Bearer ${CONFIG.API_PASSWORD}` },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream connection failed: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Buffer for parsing SSE events
    const updates: JobUpdate[] = [];
    let resolveNext: ((value: JobUpdate) => void) | null = null;

    const parser = createParser((event) => {
      if (event.type === "event") {
        try {
          const data: JobUpdate = JSON.parse(event.data);
          if (resolveNext) {
            resolveNext(data);
            resolveNext = null;
          } else {
            updates.push(data);
          }
        } catch {
          // Ignore parse errors for keep-alive messages
        }
      }
    });

    // Start reading in background
    const readLoop = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value));
      }
    };

    const readPromise = readLoop();

    // Yield updates as they come
    while (true) {
      if (updates.length > 0) {
        const update = updates.shift()!;
        yield update;

        // Check for terminal states
        if (update.status === "completed" || update.status === "failed") {
          break;
        }
      } else {
        // Wait for next update
        const update = await new Promise<JobUpdate>((resolve) => {
          resolveNext = resolve;
        });
        yield update;

        if (update.status === "completed" || update.status === "failed") {
          break;
        }
      }
    }

    await readPromise;
  }

  /**
   * Wait for job completion and return the metadata URI
   */
  async waitForCompletion(videoId: string): Promise<string> {
    for await (const update of this.streamJobUpdates(videoId)) {
      if (update.status === "completed" && update.metadata_uri) {
        return update.metadata_uri;
      }
      if (update.status === "failed") {
        throw new Error(update.error || "Job failed with unknown error");
      }
    }
    throw new Error("Stream ended without completion");
  }

  /**
   * Fetch the slide manifest from S3
   */
  async fetchManifest(s3Uri: string): Promise<SlideManifest> {
    const urlParts = s3Uri.replace("s3://", "").split("/");
    const bucket = urlParts.shift();
    const key = urlParts.join("/");

    if (!bucket || !key) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    const httpUrl = `${CONFIG.S3_BASE}/${bucket}/${key}`;
    const response = await getS3Client().fetch(httpUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate a signed URL for an S3 object (valid for 1 hour)
   */
  async getSignedUrl(s3Uri: string): Promise<string> {
    const urlParts = s3Uri.replace("s3://", "").split("/");
    const bucket = urlParts.shift();
    const key = urlParts.join("/");

    const url = new URL(`${CONFIG.S3_BASE}/${bucket}/${key}`);

    const signed = await getS3Client().sign(url, {
      method: "GET",
      aws: { signQuery: true },
    });

    return signed.url;
  }

  /**
   * Get all static segments (slides) from a manifest
   */
  getStaticSegments(
    manifest: SlideManifest,
    videoId: string,
  ): StaticSegment[] {
    const videoData = manifest[videoId];
    if (!videoData) return [];

    return videoData.segments.filter(
      (seg): seg is StaticSegment =>
        seg.kind === "static" && !seg.skip_reason,
    );
  }
}

// Export singleton instance
export const slidesClient = new SlidesExtractorClient();
