// app/workflows/extract-slides.ts

import { fetch, getWritable } from "workflow";
import { AwsClient } from "aws4fetch";
import { createParser } from "eventsource-parser";
import type { Chapter } from "@/ai/transcript-to-book-schema";

// Types declared inline to avoid import issues in workflow context
interface JobUpdate {
  status: string;
  progress: number;
  message: string;
  updated_at: string;
  video_id?: string;
  metadata_uri?: string;
  error?: string;
}

interface SlideManifest {
  [videoId: string]: {
    segments: VideoSegment[];
  };
}

type VideoSegment = MovingSegment | StaticSegment;

interface MovingSegment {
  kind: "moving";
  start_time: number;
  end_time: number;
}

interface StaticSegment {
  kind: "static";
  start_time: number;
  end_time: number;
  frame_id: string;
  url: string;
  s3_uri: string;
  s3_key: string;
  s3_bucket: string;
  has_text: boolean;
  text_confidence: number;
  text_box_count: number;
  skip_reason: string | null;
}

// Stream event types for the frontend
interface SlideStreamEvent {
  type: "progress" | "slide" | "complete" | "error";
  data: unknown;
}

const CONFIG = {
  API_BASE:
    process.env.SLIDES_API_BASE || "https://slides-extractor.remtoolz.ai",
  S3_BASE: process.env.S3_BASE_URL || "https://s3.remtoolz.ai",
  API_PASSWORD: process.env.SLIDES_API_PASSWORD!,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY!,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY!,
};

/**
 * Main workflow for extracting slides from a YouTube video
 * Streams progress and slides to the frontend
 */
export async function extractSlidesWorkflow(
  videoId: string,
  chapters?: Chapter[],
) {
  "use workflow";

  // Step 1: Trigger the extraction job
  await triggerExtractionJob(videoId);

  // Step 2: Monitor progress and stream updates
  const metadataUri = await monitorJobProgress(videoId);

  // Step 3: Fetch the manifest
  const manifest = await fetchSlideManifest(metadataUri);

  // Step 4: Stream slides with signed URLs
  const totalSlides = await streamSlidesToFrontend(videoId, manifest, chapters);

  // Step 5: Signal completion
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
      status: "pending",
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

  return new Promise<string>((resolve, reject) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const parser = createParser(async (event) => {
      if (event.type === "event") {
        try {
          const data: JobUpdate = JSON.parse(event.data);

          // Stream progress to frontend
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

  const urlParts = s3Uri.replace("s3://", "").split("/");
  const bucket = urlParts.shift();
  const key = urlParts.join("/");

  const s3Client = new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: "s3",
    region: "us-east-1",
  });

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

  const s3Client = new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: "s3",
    region: "us-east-1",
  });

  const videoData = manifest[videoId];
  if (!videoData) {
    writer.releaseLock();
    return 0;
  }

  // Filter to static segments (actual slides)
  const slides = videoData.segments.filter(
    (seg): seg is StaticSegment => seg.kind === "static" && !seg.skip_reason,
  );

  // Parse chapter timestamps for matching
  const chapterTimestamps =
    chapters?.map((ch) => parseTimestamp(ch.start)) || [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    // Generate signed URL for the image
    const urlParts = slide.s3_uri.replace("s3://", "").split("/");
    const bucket = urlParts.shift();
    const key = urlParts.join("/");
    const signedUrl = await generateSignedUrl(s3Client, bucket!, key);

    // Determine which chapter this slide belongs to
    const chapterIndex = findChapterIndex(slide.start_time, chapterTimestamps);

    await writer.write({
      type: "slide",
      data: {
        slide_index: i,
        chapter_index: chapterIndex,
        frame_id: slide.frame_id,
        start_time: slide.start_time,
        end_time: slide.end_time,
        image_url: signedUrl,
        has_text: slide.has_text,
        text_confidence: slide.text_confidence,
      },
    });
  }

  writer.releaseLock();
  return slides.length;
}

async function generateSignedUrl(
  s3Client: AwsClient,
  bucket: string,
  key: string,
): Promise<string> {
  const url = new URL(`${CONFIG.S3_BASE}/${bucket}/${key}`);
  const signed = await s3Client.sign(url, {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url;
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

/**
 * Parse timestamp string to seconds
 * Supports "MM:SS" and "HH:MM:SS" formats
 */
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

/**
 * Find which chapter a slide belongs to based on timestamp
 */
function findChapterIndex(slideTime: number, chapterStarts: number[]): number {
  for (let i = chapterStarts.length - 1; i >= 0; i--) {
    if (slideTime >= chapterStarts[i]) {
      return i;
    }
  }
  return 0;
}
