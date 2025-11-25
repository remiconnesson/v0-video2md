// lib/mock-slides-data.ts

import type { SlideStreamEvent } from "./slides-extractor-types";
import { JobStatus } from "./slides-extractor-types";

// Mock slide data for frontend development
export const mockSlideEvents: SlideStreamEvent[] = [
  {
    type: "progress",
    data: {
      status: JobStatus.PENDING,
      progress: 0,
      message: "Starting video processing...",
    },
  },
  {
    type: "progress",
    data: {
      status: JobStatus.DOWNLOADING,
      progress: 15,
      message: "Downloading video from YouTube...",
    },
  },
  {
    type: "progress",
    data: {
      status: JobStatus.DOWNLOADING,
      progress: 35,
      message: "Download in progress...",
    },
  },
  {
    type: "progress",
    data: {
      status: JobStatus.EXTRACTING,
      progress: 50,
      message: "Analyzing video frames...",
    },
  },
  {
    type: "progress",
    data: {
      status: JobStatus.EXTRACTING,
      progress: 65,
      message: "Detecting static segments...",
    },
  },
  {
    type: "progress",
    data: {
      status: JobStatus.UPLOADING,
      progress: 80,
      message: "Uploading extracted slides...",
    },
  },
  // Chapter 0 slides
  {
    type: "slide",
    data: {
      slide_index: 0,
      chapter_index: 0,
      frame_id: "static_frame_000001.webp",
      start_time: 45,
      end_time: 120,
      image_url: "https://picsum.photos/seed/slide1/1280/720",
      has_text: true,
      text_confidence: 0.95,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 1,
      chapter_index: 0,
      frame_id: "static_frame_000002.webp",
      start_time: 130,
      end_time: 200,
      image_url: "https://picsum.photos/seed/slide2/1280/720",
      has_text: true,
      text_confidence: 0.88,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 2,
      chapter_index: 0,
      frame_id: "static_frame_000003.webp",
      start_time: 210,
      end_time: 280,
      image_url: "https://picsum.photos/seed/slide3/1280/720",
      has_text: true,
      text_confidence: 0.91,
    },
  },
  // Chapter 1 slides
  {
    type: "slide",
    data: {
      slide_index: 3,
      chapter_index: 1,
      frame_id: "static_frame_000004.webp",
      start_time: 320,
      end_time: 380,
      image_url: "https://picsum.photos/seed/slide4/1280/720",
      has_text: true,
      text_confidence: 0.92,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 4,
      chapter_index: 1,
      frame_id: "static_frame_000005.webp",
      start_time: 390,
      end_time: 450,
      image_url: "https://picsum.photos/seed/slide5/1280/720",
      has_text: false,
      text_confidence: 0.15,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 5,
      chapter_index: 1,
      frame_id: "static_frame_000006.webp",
      start_time: 460,
      end_time: 520,
      image_url: "https://picsum.photos/seed/slide6/1280/720",
      has_text: true,
      text_confidence: 0.89,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 6,
      chapter_index: 1,
      frame_id: "static_frame_000007.webp",
      start_time: 530,
      end_time: 590,
      image_url: "https://picsum.photos/seed/slide7/1280/720",
      has_text: true,
      text_confidence: 0.94,
    },
  },
  // Chapter 2 slides
  {
    type: "slide",
    data: {
      slide_index: 7,
      chapter_index: 2,
      frame_id: "static_frame_000008.webp",
      start_time: 650,
      end_time: 720,
      image_url: "https://picsum.photos/seed/slide8/1280/720",
      has_text: true,
      text_confidence: 0.97,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 8,
      chapter_index: 2,
      frame_id: "static_frame_000009.webp",
      start_time: 730,
      end_time: 800,
      image_url: "https://picsum.photos/seed/slide9/1280/720",
      has_text: true,
      text_confidence: 0.86,
    },
  },
  // Chapter 3 slides (more slides to show accordion behavior)
  {
    type: "slide",
    data: {
      slide_index: 9,
      chapter_index: 3,
      frame_id: "static_frame_000010.webp",
      start_time: 850,
      end_time: 920,
      image_url: "https://picsum.photos/seed/slide10/1280/720",
      has_text: true,
      text_confidence: 0.93,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 10,
      chapter_index: 3,
      frame_id: "static_frame_000011.webp",
      start_time: 930,
      end_time: 1000,
      image_url: "https://picsum.photos/seed/slide11/1280/720",
      has_text: true,
      text_confidence: 0.88,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 11,
      chapter_index: 3,
      frame_id: "static_frame_000012.webp",
      start_time: 1010,
      end_time: 1080,
      image_url: "https://picsum.photos/seed/slide12/1280/720",
      has_text: true,
      text_confidence: 0.91,
    },
  },
  {
    type: "complete",
    data: {
      total_slides: 12,
      video_id: "mock-video-id",
    },
  },
];

/**
 * Helper to simulate streaming with configurable delay
 */
export async function* simulateSlideStream(
  delayMs = 300,
): AsyncGenerator<SlideStreamEvent> {
  for (const event of mockSlideEvents) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield event;
  }
}

/**
 * Create a ReadableStream that simulates the slide extraction
 * Useful for testing the frontend without the backend
 */
export function createMockSlideStream(delayMs = 300): ReadableStream<string> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for await (const event of simulateSlideStream(delayMs)) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });
}

/**
 * Group slides by chapter index for easier rendering
 */
export function groupSlidesByChapter(
  events: SlideStreamEvent[],
): Map<number, SlideStreamEvent[]> {
  const groups = new Map<number, SlideStreamEvent[]>();

  for (const event of events) {
    if (event.type === "slide") {
      const chapterIndex = event.data.chapter_index;
      if (!groups.has(chapterIndex)) {
        groups.set(chapterIndex, []);
      }
      groups.get(chapterIndex)!.push(event);
    }
  }

  return groups;
}
