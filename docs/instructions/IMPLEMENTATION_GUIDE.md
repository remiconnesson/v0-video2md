# Slides Extractor Integration - Implementation Guide

This guide is for an AI agent implementing the full workflow pipeline connecting the **slides-extractor.remtoolz.ai** service to the **video2md** Next.js frontend.

---

## Overview

You are implementing a **durable workflow** that:
1. Triggers video processing on the slides extractor service
2. Streams progress updates to the frontend
3. Fetches slide images from S3 and streams them to the UI
4. Associates slides with transcript chapters

The frontend agent is separately handling the UI with Streamdown renderers, accordion chapters, and slide feedback buttons.

---

## Architecture Summary

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend  │────▶│  API Route       │────▶│  Workflow DevKit    │
│  (Next.js)  │◀────│  (streams)       │◀────│  (durable workflow) │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                                                       │
                                                       ▼
                                    ┌─────────────────────────────────┐
                                    │  slides-extractor.remtoolz.ai  │
                                    │  - POST /process/youtube/{id}  │
                                    │  - GET /jobs/{id}/stream (SSE) │
                                    └─────────────────────────────────┘
                                                       │
                                                       ▼
                                              ┌──────────────┐
                                              │ S3 Storage   │
                                              │ s3.remtoolz  │
                                              └──────────────┘
```

---

## Part 1: Type Definitions

Create `lib/slides-extractor-types.ts`:

```typescript
// lib/slides-extractor-types.ts

export enum JobStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  EXTRACTING = 'extracting',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface JobUpdate {
  status: JobStatus;
  progress: number;
  message: string;
  updated_at: string;
  video_id?: string;
  metadata_uri?: string;  // Only when status === 'completed'
  error?: string;         // Only when status === 'failed'
}

export interface SlideManifest {
  [videoId: string]: {
    segments: VideoSegment[];
  };
}

export type VideoSegment = MovingSegment | StaticSegment;

export interface BaseSegment {
  start_time: number;
  end_time: number;
}

export interface MovingSegment extends BaseSegment {
  kind: 'moving';
}

export interface StaticSegment extends BaseSegment {
  kind: 'static';
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

// For streaming to frontend
export interface SlideStreamEvent {
  type: 'progress' | 'slide' | 'complete' | 'error';
  data: ProgressEvent | SlideEvent | CompleteEvent | ErrorEvent;
}

export interface ProgressEvent {
  status: JobStatus;
  progress: number;
  message: string;
}

export interface SlideEvent {
  slide_index: number;
  chapter_index: number;  // Which chapter this slide belongs to
  frame_id: string;
  start_time: number;
  end_time: number;
  image_url: string;      // Signed S3 URL
  has_text: boolean;
  text_confidence: number;
}

export interface CompleteEvent {
  total_slides: number;
  video_id: string;
}

export interface ErrorEvent {
  message: string;
  code?: string;
}
```

---

## Part 2: Environment Variables

Add to `.env.local`:

```env
# Slides Extractor Service
SLIDES_API_PASSWORD=your_api_password
SLIDES_API_BASE=https://slides-extractor.remtoolz.ai

# S3 Storage (for signed URLs)
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_BASE_URL=https://s3.remtoolz.ai
S3_REGION=us-east-1
```

---

## Part 3: Slides Extractor Client

Create `lib/slides-extractor-client.ts`:

```typescript
// lib/slides-extractor-client.ts

import { AwsClient } from 'aws4fetch';
import { createParser } from 'eventsource-parser';
import type {
  JobStatus,
  JobUpdate,
  SlideManifest,
  StaticSegment,
} from './slides-extractor-types';

const CONFIG = {
  API_BASE: process.env.SLIDES_API_BASE || 'https://slides-extractor.remtoolz.ai',
  S3_BASE: process.env.S3_BASE_URL || 'https://s3.remtoolz.ai',
  API_PASSWORD: process.env.SLIDES_API_PASSWORD!,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY!,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY!,
  S3_REGION: process.env.S3_REGION || 'us-east-1',
};

// Lazy-initialize S3 client
let _s3Client: AwsClient | null = null;
function getS3Client(): AwsClient {
  if (!_s3Client) {
    _s3Client = new AwsClient({
      accessKeyId: CONFIG.S3_ACCESS_KEY,
      secretAccessKey: CONFIG.S3_SECRET_KEY,
      service: 's3',
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
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.API_PASSWORD}`,
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
      headers: { 'Authorization': `Bearer ${CONFIG.API_PASSWORD}` },
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
      if (event.type === 'event') {
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
        if (update.status === 'completed' || update.status === 'failed') {
          break;
        }
      } else {
        // Wait for next update
        const update = await new Promise<JobUpdate>((resolve) => {
          resolveNext = resolve;
        });
        yield update;
        
        if (update.status === 'completed' || update.status === 'failed') {
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
      if (update.status === 'completed' && update.metadata_uri) {
        return update.metadata_uri;
      }
      if (update.status === 'failed') {
        throw new Error(update.error || 'Job failed with unknown error');
      }
    }
    throw new Error('Stream ended without completion');
  }

  /**
   * Fetch the slide manifest from S3
   */
  async fetchManifest(s3Uri: string): Promise<SlideManifest> {
    const urlParts = s3Uri.replace('s3://', '').split('/');
    const bucket = urlParts.shift();
    const key = urlParts.join('/');

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
    const urlParts = s3Uri.replace('s3://', '').split('/');
    const bucket = urlParts.shift();
    const key = urlParts.join('/');

    const url = new URL(`${CONFIG.S3_BASE}/${bucket}/${key}`);
    
    const signed = await getS3Client().sign(url, {
      method: 'GET',
      aws: { signQuery: true },
    });

    return signed.url;
  }

  /**
   * Get all static segments (slides) from a manifest
   */
  getStaticSegments(manifest: SlideManifest, videoId: string): StaticSegment[] {
    const videoData = manifest[videoId];
    if (!videoData) return [];
    
    return videoData.segments.filter(
      (seg): seg is StaticSegment => 
        seg.kind === 'static' && !seg.skip_reason
    );
  }
}

// Export singleton instance
export const slidesClient = new SlidesExtractorClient();
```

---

## Part 4: Workflow Implementation

Create `app/workflows/extract-slides.ts`:

```typescript
// app/workflows/extract-slides.ts

import { fetch, getWritable, sleep } from 'workflow';
import { AwsClient } from 'aws4fetch';
import { createParser } from 'eventsource-parser';
import type { Chapter } from '@/ai/transcript-to-book-schema';

// Re-declare types here to avoid import issues in workflow context
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
  kind: 'moving';
  start_time: number;
  end_time: number;
}

interface StaticSegment {
  kind: 'static';
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
  type: 'progress' | 'slide' | 'complete' | 'error';
  data: unknown;
}

const CONFIG = {
  API_BASE: process.env.SLIDES_API_BASE || 'https://slides-extractor.remtoolz.ai',
  S3_BASE: process.env.S3_BASE_URL || 'https://s3.remtoolz.ai',
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
  chapters?: Chapter[]
) {
  'use workflow';

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
  'use step';

  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();

  await writer.write({
    type: 'progress',
    data: {
      status: 'pending',
      progress: 0,
      message: 'Starting video processing...',
    },
  });
  writer.releaseLock();

  const response = await fetch(
    `${CONFIG.API_BASE}/process/youtube/${videoId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CONFIG.API_PASSWORD}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger job: ${response.status} - ${text}`);
  }
}

async function monitorJobProgress(videoId: string): Promise<string> {
  'use step';

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
      if (event.type === 'event') {
        try {
          const data: JobUpdate = JSON.parse(event.data);
          
          // Stream progress to frontend
          const writer = writable.getWriter();
          await writer.write({
            type: 'progress',
            data: {
              status: data.status,
              progress: data.progress,
              message: data.message,
            },
          });
          writer.releaseLock();

          if (data.status === 'completed' && data.metadata_uri) {
            resolve(data.metadata_uri);
          } else if (data.status === 'failed') {
            reject(new Error(data.error || 'Job failed'));
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
  'use step';

  const urlParts = s3Uri.replace('s3://', '').split('/');
  const bucket = urlParts.shift();
  const key = urlParts.join('/');

  const s3Client = new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: 's3',
    region: 'us-east-1',
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
  chapters?: Chapter[]
): Promise<number> {
  'use step';

  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();

  const s3Client = new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: 's3',
    region: 'us-east-1',
  });

  const videoData = manifest[videoId];
  if (!videoData) {
    writer.releaseLock();
    return 0;
  }

  // Filter to static segments (actual slides)
  const slides = videoData.segments.filter(
    (seg): seg is StaticSegment => seg.kind === 'static' && !seg.skip_reason
  );

  // Parse chapter timestamps for matching
  const chapterTimestamps = chapters?.map((ch) => parseTimestamp(ch.start)) || [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    // Generate signed URL for the image
    const urlParts = slide.s3_uri.replace('s3://', '').split('/');
    const bucket = urlParts.shift();
    const key = urlParts.join('/');
    const signedUrl = await generateSignedUrl(s3Client, bucket!, key);

    // Determine which chapter this slide belongs to
    const chapterIndex = findChapterIndex(slide.start_time, chapterTimestamps);

    await writer.write({
      type: 'slide',
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
  key: string
): Promise<string> {
  const url = new URL(`${CONFIG.S3_BASE}/${bucket}/${key}`);
  const signed = await s3Client.sign(url, {
    method: 'GET',
    aws: { signQuery: true },
  });
  return signed.url;
}

async function signalCompletion(videoId: string, totalSlides: number) {
  'use step';

  const writable = getWritable<SlideStreamEvent>();
  const writer = writable.getWriter();

  await writer.write({
    type: 'complete',
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
  const parts = timestamp.split(':').map(Number);
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
```

---

## Part 5: API Routes

### 5.1 Start Slide Extraction

Create `app/api/video/[videoId]/slides/route.ts`:

```typescript
// app/api/video/[videoId]/slides/route.ts

import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { extractSlidesWorkflow } from '@/app/workflows/extract-slides';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const body = await request.json().catch(() => ({}));
  const chapters = body.chapters; // Optional chapters for slide-chapter mapping

  try {
    const run = await start(extractSlidesWorkflow, [videoId, chapters]);

    return new NextResponse(run.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Workflow-Run-Id': run.runId,
      },
    });
  } catch (error) {
    console.error('Failed to start slides extraction:', error);
    return NextResponse.json(
      { error: 'Failed to start slide extraction' },
      { status: 500 }
    );
  }
}
```

### 5.2 Resume Stream (for reconnection)

Create `app/api/video/[videoId]/slides/[runId]/stream/route.ts`:

```typescript
// app/api/video/[videoId]/slides/[runId]/stream/route.ts

import { NextResponse } from 'next/server';
import { getRun } from 'workflow/api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> }
) {
  const { runId } = await params;
  const url = new URL(request.url);
  const startIndexParam = url.searchParams.get('startIndex');
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : undefined;

  try {
    const run = getRun(runId);
    const stream = run.getReadable({ startIndex });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to resume stream:', error);
    return NextResponse.json(
      { error: 'Failed to resume stream' },
      { status: 500 }
    );
  }
}
```

### 5.3 Slide Feedback Endpoint

Create `app/api/video/[videoId]/slides/feedback/route.ts`:

```typescript
// app/api/video/[videoId]/slides/feedback/route.ts

import { NextResponse } from 'next/server';

interface SlideFeedback {
  slide_index: number;
  frame_id: string;
  feedback_type: 'duplicate' | 'not_relevant';
  chapter_index?: number;
  timestamp?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  const body: SlideFeedback = await request.json();

  // Validate required fields
  if (!body.frame_id || !body.feedback_type) {
    return NextResponse.json(
      { error: 'Missing required fields: frame_id, feedback_type' },
      { status: 400 }
    );
  }

  // Log feedback (replace with actual storage later)
  console.log('[Slide Feedback]', {
    videoId,
    ...body,
    timestamp: new Date().toISOString(),
  });

  // TODO: Store feedback in database
  // await db.insert(slideFeedback).values({
  //   videoId,
  //   frameId: body.frame_id,
  //   feedbackType: body.feedback_type,
  //   slideIndex: body.slide_index,
  //   chapterIndex: body.chapter_index,
  // });

  return NextResponse.json({
    success: true,
    message: `Feedback recorded: ${body.feedback_type}`,
  });
}
```

---

## Part 6: Combined Workflow (Transcript + Slides)

Update `app/workflows/fetch-transcript.ts` to optionally trigger slides extraction:

```typescript
// Add to existing fetch-transcript.ts

import { extractSlidesWorkflow } from './extract-slides';

// Modify the workflow to accept extractSlides option
export async function fetchAndStoreTranscriptWorkflow(
  videoId: string,
  options?: { extractSlides?: boolean }
) {
  'use workflow';

  const apifyResult = await stepFetchFromApify(videoId);

  if (!apifyResult) {
    throw new Error(`Apify returned no results for video ID: ${videoId}`);
  }

  await stepSaveToDb(apifyResult);

  let bookContent: TranscriptToBook | null = null;

  if (apifyResult.transcript && apifyResult.transcript.length > 0) {
    bookContent = await stepGenerateBookContent({
      transcript: apifyResult.transcript,
      title: apifyResult.title,
      description: apifyResult.description,
      channelName: apifyResult.channelName,
    });

    if (bookContent) {
      await stepSaveBookContent(apifyResult.id, bookContent);
    }
  }

  // Optionally extract slides (runs in parallel after book content is ready)
  if (options?.extractSlides && bookContent) {
    // Note: This will be streamed separately - the workflow just kicks it off
    // The frontend will handle the slide stream independently
  }

  return {
    success: true,
    videoId: apifyResult.id,
    title: apifyResult.title,
    hasBookContent: bookContent !== null,
    chapters: bookContent?.chapters || [],
  };
}
```

---

## Part 7: Frontend Integration (Mock Data for Other Agent)

The frontend agent needs these mock data structures. Create `lib/mock-slides-data.ts`:

```typescript
// lib/mock-slides-data.ts

import type { SlideStreamEvent } from './slides-extractor-types';

// Mock slide data for frontend development
export const mockSlides: SlideStreamEvent[] = [
  {
    type: 'progress',
    data: {
      status: 'downloading',
      progress: 25,
      message: 'Downloading video...',
    },
  },
  {
    type: 'progress',
    data: {
      status: 'extracting',
      progress: 50,
      message: 'Analyzing frames...',
    },
  },
  {
    type: 'slide',
    data: {
      slide_index: 0,
      chapter_index: 0,
      frame_id: 'static_frame_000001.webp',
      start_time: 45,
      end_time: 120,
      image_url: 'https://picsum.photos/seed/slide1/1280/720',
      has_text: true,
      text_confidence: 0.95,
    },
  },
  {
    type: 'slide',
    data: {
      slide_index: 1,
      chapter_index: 0,
      frame_id: 'static_frame_000002.webp',
      start_time: 130,
      end_time: 200,
      image_url: 'https://picsum.photos/seed/slide2/1280/720',
      has_text: true,
      text_confidence: 0.88,
    },
  },
  {
    type: 'slide',
    data: {
      slide_index: 2,
      chapter_index: 1,
      frame_id: 'static_frame_000003.webp',
      start_time: 250,
      end_time: 310,
      image_url: 'https://picsum.photos/seed/slide3/1280/720',
      has_text: true,
      text_confidence: 0.92,
    },
  },
  {
    type: 'slide',
    data: {
      slide_index: 3,
      chapter_index: 1,
      frame_id: 'static_frame_000004.webp',
      start_time: 320,
      end_time: 380,
      image_url: 'https://picsum.photos/seed/slide4/1280/720',
      has_text: false,
      text_confidence: 0.1,
    },
  },
  {
    type: 'slide',
    data: {
      slide_index: 4,
      chapter_index: 2,
      frame_id: 'static_frame_000005.webp',
      start_time: 450,
      end_time: 520,
      image_url: 'https://picsum.photos/seed/slide5/1280/720',
      has_text: true,
      text_confidence: 0.97,
    },
  },
  {
    type: 'complete',
    data: {
      total_slides: 5,
      video_id: 'mock-video-id',
    },
  },
];

// Helper to simulate streaming
export async function* simulateSlideStream(
  delayMs = 500
): AsyncGenerator<SlideStreamEvent> {
  for (const event of mockSlides) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield event;
  }
}
```

---

## Part 8: Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "aws4fetch": "^1.0.20",
    "eventsource-parser": "^3.0.0"
  }
}
```

Install:
```bash
pnpm add aws4fetch eventsource-parser
```

---

## Part 9: File Structure Summary

After implementation, you should have:

```
lib/
├── slides-extractor-types.ts    # Type definitions
├── slides-extractor-client.ts   # Client for direct use (non-workflow)
├── mock-slides-data.ts          # Mock data for frontend development

app/
├── workflows/
│   ├── fetch-transcript.ts      # Existing (modified)
│   └── extract-slides.ts        # NEW: Slides extraction workflow
├── api/
│   └── video/
│       └── [videoId]/
│           └── slides/
│               ├── route.ts              # POST: Start extraction
│               ├── feedback/
│               │   └── route.ts          # POST: Submit feedback
│               └── [runId]/
│                   └── stream/
│                       └── route.ts      # GET: Resume stream
```

---

## Part 10: Testing Checklist

Before deployment, verify:

1. **Workflow triggers correctly**
   ```bash
   curl -X POST http://localhost:3000/api/video/dQw4w9WgXcQ/slides \
     -H "Content-Type: application/json" \
     -d '{"chapters": []}'
   ```

2. **SSE stream works**
   - Events are properly formatted as `data: {...}\n\n`
   - Frontend can reconnect using `X-Workflow-Run-Id`

3. **S3 signing works**
   - Signed URLs are valid and load images
   - URLs expire after 1 hour

4. **Feedback endpoint works**
   ```bash
   curl -X POST http://localhost:3000/api/video/test/slides/feedback \
     -H "Content-Type: application/json" \
     -d '{"frame_id": "test", "feedback_type": "duplicate", "slide_index": 0}'
   ```

5. **Error handling**
   - Job failures are properly reported
   - Network disconnections can resume

---

## Notes for Frontend Agent

The frontend agent should implement:

1. **Streamdown renderers** for each chapter's `bookChapter` content
2. **Accordion component** for collapsing/expanding chapters
3. **Slide grid** within each chapter (10-ish slides max per chapter)
4. **Hover feedback buttons** on slides:
   - 📋 (duplicate icon) → `feedback_type: 'duplicate'`
   - ❌ (X icon) → `feedback_type: 'not_relevant'`
5. **Auto-expand** the chapter currently being streamed
6. **Progressive image loading** as slides stream in

The stream event structure is:
- `type: 'progress'` → Update loading indicator
- `type: 'slide'` → Add slide to correct chapter
- `type: 'complete'` → Finalize UI state
- `type: 'error'` → Show error message
