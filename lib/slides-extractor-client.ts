import { AwsClient } from "aws4fetch";
import { createParser } from "eventsource-parser";

type ParserEvent =
  | { type: "event"; data: string }
  | { type: "reconnect-interval"; value: number };

import {
  JobStatus,
  type JobUpdate,
  type SlideManifest,
  type StaticSegment,
} from "./slides-extractor-types";

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}

const CONFIG = {
  API_BASE: getEnv("SLIDES_API_BASE", "https://slides-extractor.remtoolz.ai"),
  S3_BASE: getEnv("S3_BASE_URL", "https://s3.remtoolz.ai"),
  API_PASSWORD: getEnv("SLIDES_API_PASSWORD"),
  S3_ACCESS_KEY: getEnv("S3_ACCESS_KEY"),
  S3_SECRET_KEY: getEnv("S3_SECRET_KEY"),
  S3_REGION: getEnv("S3_REGION", "us-east-1"),
};

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

  async *streamJobUpdates(videoId: string): AsyncGenerator<JobUpdate> {
    const streamUrl = `${CONFIG.API_BASE}/jobs/${videoId}/stream`;

    const response = await fetch(streamUrl, {
      headers: { Authorization: `Bearer ${CONFIG.API_PASSWORD}` },
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream connection failed: ${response.statusText}`);
    }

    const body = response.body;
    const reader = body.getReader();
    const decoder = new TextDecoder();

    const updates: JobUpdate[] = [];
    let resolveNext: ((value: JobUpdate) => void) | null = null;

    const parser = (
      createParser as unknown as (onParse: (event: ParserEvent) => void) => {
        feed: (chunk: string) => void;
      }
    )((event: ParserEvent) => {
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

    const readLoop = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value));
      }
    };

    const readPromise = readLoop();

    while (true) {
      if (updates.length > 0) {
        const update = updates.shift();
        if (update) {
          yield update;

          if (
            update.status === JobStatus.COMPLETED ||
            update.status === JobStatus.FAILED
          ) {
            break;
          }
        }
      } else {
        const update = await new Promise<JobUpdate>((resolve) => {
          resolveNext = resolve;
        });
        yield update;

        if (
          update.status === JobStatus.COMPLETED ||
          update.status === JobStatus.FAILED
        ) {
          break;
        }
      }
    }

    await readPromise;
  }

  async waitForCompletion(videoId: string): Promise<string> {
    for await (const update of this.streamJobUpdates(videoId)) {
      if (update.status === JobStatus.COMPLETED && update.metadata_uri) {
        return update.metadata_uri;
      }
      if (update.status === JobStatus.FAILED) {
        throw new Error(update.error || "Job failed with unknown error");
      }
    }
    throw new Error("Stream ended without completion");
  }

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

  async getSignedUrl(s3Uri: string): Promise<string> {
    const urlParts = s3Uri.replace("s3://", "").split("/");
    const bucket = urlParts.shift();
    const key = urlParts.join("/");

    if (!bucket || !key) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    const url = new URL(`${CONFIG.S3_BASE}/${bucket}/${key}`);

    const signed = await getS3Client().sign(url, {
      method: "GET",
      aws: { signQuery: true },
    });

    return signed.url;
  }

  getStaticSegments(manifest: SlideManifest, videoId: string): StaticSegment[] {
    const videoData = manifest[videoId];
    if (!videoData) return [];

    return videoData.segments.filter(
      (seg): seg is StaticSegment => seg.kind === "static" && !seg.skip_reason,
    );
  }
}

export const slidesClient = new SlidesExtractorClient();
