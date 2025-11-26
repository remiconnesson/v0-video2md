import { AwsClient } from "aws4fetch";
import { createParser } from "eventsource-parser";
import { fetch, getWritable } from "workflow";
import type { Chapter } from "@/ai/transcript-to-book-schema";
import type {
  JobUpdate,
  SlideManifest,
  SlideStreamEvent,
  StaticSegment,
} from "@/lib/slides-extractor-types";
import { JobStatus } from "@/lib/slides-extractor-types";

type ParserEvent =
  | { type: "event"; data: string }
  | { type: "reconnect-interval"; value: number };

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
  BLOB_READ_WRITE_TOKEN: getEnv("BLOB_READ_WRITE_TOKEN"),
};

export async function extractSlidesWorkflow(
  videoId: string,
  chapters?: Chapter[],
) {
  "use workflow";

  await triggerExtractionJob(videoId);

  const metadataUri = await monitorJobProgress(videoId);

  const manifest = await fetchSlideManifest(metadataUri);

  const totalSlides = await streamSlidesToFrontend(videoId, manifest, chapters);

  await signalCompletion(videoId, totalSlides);

  return {
    success: true,
    videoId,
    totalSlides,
  };
}

async function triggerExtractionJob(videoId: string) {
  "use step";

  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();

  await writer.write({
    type: "progress",
    data: {
      status: JobStatus.PENDING,
      progress: 0,
      message: "Starting video processing...",
    },
  });
  writer.releaseLock();

  const response = await fetch(
    `${CONFIG.API_BASE}/process/youtube/${videoId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.API_PASSWORD}`,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger job: ${response.status} - ${text}`);
  }
}

async function monitorJobProgress(videoId: string): Promise<string> {
  "use step";

  const writable = getWritable<SlideStreamEvent>();
  const streamUrl = `${CONFIG.API_BASE}/jobs/${videoId}/stream`;

  const response = await fetch(streamUrl, {
    headers: { Authorization: `Bearer ${CONFIG.API_PASSWORD}` },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream connection failed: ${response.statusText}`);
  }

  const body = response.body;

  return new Promise<string>((resolve, reject) => {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    const parser = (
      createParser as unknown as (onParse: (event: ParserEvent) => void) => {
        feed: (chunk: string) => void;
      }
    )((event: ParserEvent) => {
      if (event.type === "event") {
        void (async () => {
          try {
            const data: JobUpdate = JSON.parse(event.data);

            const writer = writable.getWriter();
            await writer.write({
              type: "progress",
              data: {
                status: data.status,
                progress: data.progress,
                message: data.message,
              },
            });
            writer.releaseLock();

            if (data.status === "completed" && data.metadata_uri) {
              resolve(data.metadata_uri);
            } else if (data.status === "failed") {
              reject(new Error(data.error || "Job failed"));
            }
          } catch {
            // Ignore parse errors
          }
        })();
      }
    });

    (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value));
      }
    })();
  });
}

async function fetchSlideManifest(s3Uri: string): Promise<SlideManifest> {
  "use step";

  const { bucket, key } = parseS3Uri(s3Uri);

  const s3Client = makeAwsClient();

  const httpUrl = `${CONFIG.S3_BASE}/${bucket}/${key}`;
  const response = await s3Client.fetch(httpUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.statusText}`);
  }

  return response.json();
}

async function streamSlidesToFrontend(
  videoId: string,
  manifest: SlideManifest,
  chapters?: Chapter[],
): Promise<number> {
  "use step";

  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();

  const s3Client = makeAwsClient();

  const videoData = manifest[videoId];
  if (!videoData) {
    writer.releaseLock();
    return 0;
  }

  const slides = videoData.segments.filter(
    (seg): seg is StaticSegment => seg.kind === "static" && !seg.skip_reason,
  );

  const chapterTimestamps =
    chapters?.map((ch) => parseTimestamp(ch.start)) || [];

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      // Fetch image from S3
      const { bucket, key } = parseS3Uri(slide.s3_uri, "slide");
      const s3Url = `${CONFIG.S3_BASE}/${bucket}/${key}`;
      const imageResponse = await s3Client.fetch(s3Url);

      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch slide image: ${imageResponse.statusText}`,
        );
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      // Upload to Vercel Blob using raw fetch API
      const blobPath = `slides/${videoId}/${slide.frame_id}.webp`;
      const blobUrl = await uploadToVercelBlob(blobPath, imageBuffer);

      const chapterIndex = findChapterIndex(
        slide.start_time,
        chapterTimestamps,
      );

      await writer.write({
        type: "slide",
        data: {
          slide_index: i,
          chapter_index: chapterIndex,
          frame_id: slide.frame_id,
          start_time: slide.start_time,
          end_time: slide.end_time,
          image_url: blobUrl,
          has_text: slide.has_text,
          text_confidence: slide.text_confidence,
        },
      });
    }
  } finally {
    writer.releaseLock();
  }

  return slides.length;
}

async function uploadToVercelBlob(
  pathname: string,
  body: ArrayBuffer,
): Promise<string> {
  // Use the Vercel Blob API directly with fetch
  // https://vercel.com/docs/storage/vercel-blob/using-blob-sdk#put
  const response = await fetch(
    `https://blob.vercel-storage.com/${pathname}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CONFIG.BLOB_READ_WRITE_TOKEN}`,
        "Content-Type": "image/webp",
        "x-api-version": "7",
      },
      body,
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload to Vercel Blob: ${response.status} - ${text}`);
  }

  const result = await response.json();
  return result.url;
}

async function signalCompletion(videoId: string, totalSlides: number) {
  "use step";

  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();

  await writer.write({
    type: "complete",
    data: {
      total_slides: totalSlides,
      video_id: videoId,
    },
  });

  writer.releaseLock();
  await writable.close();
}

function makeAwsClient() {
  const s3Client = new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_ACCESS_KEY, // on purpose, see our private s3 docs
    service: "s3",
    region: "us-east-1",
  });
  return s3Client;
}

function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function findChapterIndex(slideTime: number, chapterStarts: number[]): number {
  for (let i = chapterStarts.length - 1; i >= 0; i--) {
    if (slideTime >= chapterStarts[i]) {
      return i;
    }
  }
  return 0;
}

function parseS3Uri(s3Uri: string, context?: string) {
  const urlParts = s3Uri.replace("s3://", "").split("/");
  const bucket = urlParts.shift();
  const key = urlParts.join("/");
  if (!bucket || !key) {
    const label = context ? `Invalid S3 URI on ${context}` : "Invalid S3 URI";
    throw new Error(`${label}: ${s3Uri}`);
  }
  return { bucket, key };
}
