import { JobStatus, type SlideStreamEvent } from "./slides-extractor-types";

export const mockSlides: SlideStreamEvent[] = [
  {
    type: "progress",
    data: {
      status: JobStatus.DOWNLOADING,
      progress: 25,
      message: "Downloading video...",
    },
  },
  {
    type: "progress",
    data: {
      status: JobStatus.EXTRACTING,
      progress: 50,
      message: "Analyzing frames...",
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 0,
      chapter_index: 0,
      frame_id: "static_frame_000001.webp",
      start_time: 45,
      end_time: 52,
      image_url: "https://s3.remtoolz.ai/mock/static_frame_000001.webp",
      has_text: true,
      text_confidence: 0.92,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 1,
      chapter_index: 0,
      frame_id: "static_frame_000040.webp",
      start_time: 120,
      end_time: 125,
      image_url: "https://s3.remtoolz.ai/mock/static_frame_000040.webp",
      has_text: true,
      text_confidence: 0.94,
    },
  },
  {
    type: "slide",
    data: {
      slide_index: 2,
      chapter_index: 1,
      frame_id: "static_frame_000075.webp",
      start_time: 210,
      end_time: 216,
      image_url: "https://s3.remtoolz.ai/mock/static_frame_000075.webp",
      has_text: true,
      text_confidence: 0.97,
    },
  },
  {
    type: "complete",
    data: {
      total_slides: 3,
      video_id: "mock-video-id",
    },
  },
];

export async function* simulateSlideStream(
  delayMs = 500,
): AsyncGenerator<SlideStreamEvent> {
  for (const event of mockSlides) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield event;
  }
}
