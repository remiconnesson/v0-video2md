import { analyzeSlide } from "@/ai/slide-analysis";
import {
  getSlideFeedback,
  getVideoSlides,
  getVideoWithTranscript,
  saveSlideAnalysisResult,
} from "@/db/queries";
import type { SlideAnalysisTarget } from "@/lib/slides-types";
import { validateTranscriptStructure, type TranscriptSegment } from "@/lib/transcript-format";

// ============================================================================
// Picked Slide Info Interface
// ============================================================================

export interface PickedSlideInfo {
  slideNumber: number;
  framePosition: "first" | "last";
  imageUrl: string;
  startTime: number;
  endTime: number;
  videoTitle: string;
  transcriptContext: string;
}

// ============================================================================
// Step: Get picked slides with transcript context
// ============================================================================

export async function getPickedSlidesWithContext(
  videoId: string,
  targets?: SlideAnalysisTarget[],
): Promise<PickedSlideInfo[]> {
  "use step";

  // Get video with transcript
  const videoData = await getVideoWithTranscript(videoId);
  if (!videoData) {
    throw new Error("Video not found or no transcript available");
  }

  // Get all slides for this video
  const slides = await getVideoSlides(videoId);
  if (slides.length === 0) {
    throw new Error("No slides found for this video");
  }

  // Get feedback to determine which frames are picked
  const feedback = await getSlideFeedback(videoId);
  const feedbackMap = new Map(feedback.map((f) => [f.slideNumber, f]));

  // Parse transcript segments
  const transcriptSegments = validateTranscriptStructure(videoData.transcript);

  // Build list of picked slides
  const pickedSlides: PickedSlideInfo[] = [];

  for (const slide of slides) {
    const fb = feedbackMap.get(slide.slideNumber);

    // Default: no frames are picked by default
    const isFirstPicked = fb?.isFirstFramePicked ?? false;
    const isLastPicked = fb?.isLastFramePicked ?? false;

    // Get transcript context for this slide's time range
    const transcriptContext = getTranscriptContextForSlide(
      transcriptSegments,
      slide.startTime,
      slide.endTime,
    );

    if (isFirstPicked && slide.firstFrameImageUrl) {
      pickedSlides.push({
        slideNumber: slide.slideNumber,
        framePosition: "first",
        imageUrl: slide.firstFrameImageUrl,
        startTime: slide.startTime,
        endTime: slide.endTime,
        videoTitle: videoData.title,
        transcriptContext,
      });
    }

    if (isLastPicked && slide.lastFrameImageUrl) {
      pickedSlides.push({
        slideNumber: slide.slideNumber,
        framePosition: "last",
        imageUrl: slide.lastFrameImageUrl,
        startTime: slide.startTime,
        endTime: slide.endTime,
        videoTitle: videoData.title,
        transcriptContext,
      });
    }
  }

  if (!targets || targets.length === 0) {
    return pickedSlides;
  }

  const targetKeys = new Set(
    targets.map((target) => `${target.slideNumber}-${target.framePosition}`),
  );
  const filteredSlides = pickedSlides.filter((slide) =>
    targetKeys.has(`${slide.slideNumber}-${slide.framePosition}`),
  );

  if (filteredSlides.length === 0) {
    throw new Error("No matching slides found for analysis");
  }

  return filteredSlides;
}

/**
 * Extracts transcript text for a given time range, with some buffer.
 */
function getTranscriptContextForSlide(
  segments: TranscriptSegment[],
  startTime: number,
  endTime: number,
): string {
  // Add a 10-second buffer on each side for context
  const bufferStart = Math.max(0, startTime - 10);
  const bufferEnd = endTime + 10;

  // Include any segment that overlaps with the buffered time window
  const relevantSegments = segments.filter(
    (segment) => segment.end >= bufferStart && segment.start <= bufferEnd,
  );

  if (relevantSegments.length === 0) {
    return "";
  }

  return relevantSegments.map((s) => s.text).join(" ");
}

// ============================================================================
// Result type for parallel analysis
// ============================================================================

export interface SlideAnalysisResultInfo {
  slideNumber: number;
  framePosition: "first" | "last";
  markdown: string;
}

// ============================================================================
// Step: Analyze and save a single slide (combined for parallelization)
// ============================================================================

export async function analyzeAndSaveSlide(
  videoId: string,
  slideInfo: PickedSlideInfo,
): Promise<SlideAnalysisResultInfo> {
  "use step";

  // Analyze the slide
  const markdown = await analyzeSlide({
    videoTitle: slideInfo.videoTitle,
    slideNumber: slideInfo.slideNumber,
    framePosition: slideInfo.framePosition,
    imageUrl: slideInfo.imageUrl,
    transcriptContext: slideInfo.transcriptContext || undefined,
  });

  // Save to database
  await saveSlideAnalysisResult(
    videoId,
    slideInfo.slideNumber,
    slideInfo.framePosition,
    markdown,
  );

  return {
    slideNumber: slideInfo.slideNumber,
    framePosition: slideInfo.framePosition,
    markdown,
  };
}
