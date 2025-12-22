import { z } from "zod";
import { analyzeSlide } from "@/ai/slide-analysis";
import {
  getSlideFeedback,
  getVideoSlides,
  getVideoWithTranscript,
  saveSlideAnalysisResult,
} from "@/db/queries";
import type { FramePosition } from "@/db/schema";

// ============================================================================
// Transcript Schema (for validation)
// ============================================================================

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

function validateTranscriptStructure(data: unknown): TranscriptSegment[] {
  const result = z.array(TranscriptSegmentSchema).safeParse(data);
  return result.success ? result.data : [];
}

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

    // Default: first frame is picked, last frame is not
    const isFirstPicked = fb?.isFirstFramePicked ?? true;
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

  return pickedSlides;
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

  const relevantSegments = segments.filter(
    (segment) => segment.start >= bufferStart && segment.start <= bufferEnd,
  );

  if (relevantSegments.length === 0) {
    return "";
  }

  return relevantSegments.map((s) => s.text).join(" ");
}

// ============================================================================
// Step: Analyze a single picked slide
// ============================================================================

export async function analyzePickedSlide(
  slideInfo: PickedSlideInfo,
): Promise<string> {
  "use step";

  const result = await analyzeSlide({
    videoTitle: slideInfo.videoTitle,
    slideNumber: slideInfo.slideNumber,
    framePosition: slideInfo.framePosition,
    imageUrl: slideInfo.imageUrl,
    transcriptContext: slideInfo.transcriptContext || undefined,
  });

  return result;
}

// ============================================================================
// Step: Save slide analysis to database
// ============================================================================

export async function saveSlideAnalysis(
  videoId: string,
  slideNumber: number,
  framePosition: FramePosition,
  markdownContent: string,
): Promise<void> {
  "use step";

  await saveSlideAnalysisResult(
    videoId,
    slideNumber,
    framePosition,
    markdownContent,
  );
}
