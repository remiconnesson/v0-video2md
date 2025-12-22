import { z } from "zod";
import { analyzeSlide } from "@/ai/slide-analysis";
import { streamSuperAnalysis } from "@/ai/super-analysis";
import {
  getCompletedAnalysis,
  getCompletedSuperAnalysis,
  getSlideAnalysisResults,
  getSlideFeedback,
  getVideoSlides,
  getVideoWithTranscript,
  saveSlideAnalysisResult,
  saveSuperAnalysisResult,
} from "@/db/queries";
import { emit } from "@/lib/stream-utils";
import type {
  SlideAnalysisProgress,
  SuperAnalysisInputData,
  SuperAnalysisStreamEvent,
} from "@/lib/super-analysis-types";

const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

function validateTranscriptStructure(
  data: unknown,
): Array<{ start: number; end: number; text: string }> {
  return z.array(TranscriptSegmentSchema).parse(data);
}

export async function getSuperAnalysisInputData(
  videoId: string,
): Promise<SuperAnalysisInputData> {
  "use step";

  const videoData = await getVideoWithTranscript(videoId);
  if (!videoData) {
    throw new Error("Video not found or no transcript available");
  }

  const transcriptAnalysisResult = await getCompletedAnalysis(videoId);
  if (!transcriptAnalysisResult?.result) {
    throw new Error("Transcript analysis not found");
  }

  const slideAnalysisResults = await getSlideAnalysisResults(videoId);
  if (slideAnalysisResults.length === 0) {
    throw new Error("No slide analysis results found");
  }

  const slides = await getVideoSlides(videoId);
  const slideMap = new Map(slides.map((slide) => [slide.slideNumber, slide]));

  const slidesAnalysis = slideAnalysisResults.map((result) => {
    const slide = slideMap.get(result.slideNumber);
    if (!slide) {
      throw new Error(`Slide ${result.slideNumber} not found`);
    }

    const imageUrl =
      result.framePosition === "first"
        ? slide.firstFrameImageUrl
        : slide.lastFrameImageUrl;

    if (!imageUrl) {
      throw new Error(
        `Image URL not found for slide ${result.slideNumber} frame ${result.framePosition}`,
      );
    }

    return {
      slideNumber: result.slideNumber,
      framePosition: result.framePosition,
      markdown: result.markdownContent,
      imageUrl,
      startTime: slide.startTime,
      endTime: slide.endTime,
    };
  });

  const transcriptSegments = validateTranscriptStructure(videoData.transcript);

  return {
    videoId,
    title: videoData.title,
    channelName: videoData.channelName,
    description: videoData.description || null,
    durationSeconds: videoData.durationSeconds || null,
    transcriptAnalysis: transcriptAnalysisResult.result ?? {},
    slidesAnalysis,
    transcriptSegments,
  };
}

export async function checkExistingSuperAnalysis(videoId: string) {
  "use step";
  return await getCompletedSuperAnalysis(videoId);
}

// ============================================================================
// Slide Analysis Types for Super Analysis
// ============================================================================

interface PickedSlideInfo {
  slideNumber: number;
  framePosition: "first" | "last";
  imageUrl: string;
  startTime: number;
  endTime: number;
  videoTitle: string;
  transcriptContext: string;
}

// ============================================================================
// Step: Get picked slides for super analysis
// ============================================================================

export async function getPickedSlidesForSuperAnalysis(
  videoId: string,
): Promise<PickedSlideInfo[]> {
  "use step";

  const videoData = await getVideoWithTranscript(videoId);
  if (!videoData) {
    throw new Error("Video not found or no transcript available");
  }

  const slides = await getVideoSlides(videoId);
  if (slides.length === 0) {
    throw new Error("No slides found for this video");
  }

  const feedback = await getSlideFeedback(videoId);
  const feedbackMap = new Map(feedback.map((f) => [f.slideNumber, f]));

  const transcriptSegments = validateTranscriptStructure(videoData.transcript);

  const pickedSlides: PickedSlideInfo[] = [];

  for (const slide of slides) {
    const fb = feedbackMap.get(slide.slideNumber);
    const isFirstPicked = fb?.isFirstFramePicked ?? false;
    const isLastPicked = fb?.isLastFramePicked ?? false;

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

function getTranscriptContextForSlide(
  segments: Array<{ start: number; end: number; text: string }>,
  startTime: number,
  endTime: number,
): string {
  const bufferStart = Math.max(0, startTime - 10);
  const bufferEnd = endTime + 10;

  const relevantSegments = segments.filter(
    (segment) => segment.end >= bufferStart && segment.start <= bufferEnd,
  );

  if (relevantSegments.length === 0) {
    return "";
  }

  return relevantSegments.map((s) => s.text).join(" ");
}

// ============================================================================
// Step: Run slide analysis for a single slide
// ============================================================================

export async function runSingleSlideAnalysis(
  videoId: string,
  slideInfo: PickedSlideInfo,
): Promise<{
  slideNumber: number;
  framePosition: "first" | "last";
  markdown: string;
}> {
  "use step";

  const markdown = await analyzeSlide({
    videoTitle: slideInfo.videoTitle,
    slideNumber: slideInfo.slideNumber,
    framePosition: slideInfo.framePosition,
    imageUrl: slideInfo.imageUrl,
    transcriptContext: slideInfo.transcriptContext || undefined,
  });

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

// ============================================================================
// Step: Check which slides already have analysis results
// ============================================================================

export async function getExistingSlideAnalysisResults(videoId: string) {
  "use step";
  return await getSlideAnalysisResults(videoId);
}

// ============================================================================
// Helper: Create initial slide progress state
// ============================================================================

export function createInitialSlideProgress(
  pickedSlides: PickedSlideInfo[],
  existingResults: Array<{ slideNumber: number; framePosition: string }>,
): SlideAnalysisProgress[] {
  const existingSet = new Set(
    existingResults.map((r) => `${r.slideNumber}-${r.framePosition}`),
  );

  return pickedSlides.map((slide) => {
    const key = `${slide.slideNumber}-${slide.framePosition}`;
    return {
      slideNumber: slide.slideNumber,
      framePosition: slide.framePosition,
      status: existingSet.has(key)
        ? ("completed" as const)
        : ("pending" as const),
    };
  });
}

export async function runSuperAnalysisStep(
  inputData: SuperAnalysisInputData,
  writable: WritableStream<SuperAnalysisStreamEvent>,
) {
  "use step";

  const analysisStream = streamSuperAnalysis(inputData);

  for await (const chunk of analysisStream.textStream) {
    await emit<SuperAnalysisStreamEvent>(
      { type: "partial", data: chunk },
      writable,
    );
  }

  return await analysisStream.text;
}

export async function saveSuperAnalysisResultStep(
  videoId: string,
  finalResult: string,
) {
  "use step";
  await saveSuperAnalysisResult(videoId, finalResult);
}
