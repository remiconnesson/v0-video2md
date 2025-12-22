import { streamSuperAnalysis } from "@/ai/super-analysis";
import {
  getCompletedAnalysis,
  getCompletedSuperAnalysis,
  getSlideAnalysisResults,
  getVideoSlides,
  getVideoWithTranscript,
  saveSuperAnalysisResult,
} from "@/db/queries";
import { emit } from "@/lib/stream-utils";
import type {
  SuperAnalysisInputData,
  SuperAnalysisStreamEvent,
} from "@/lib/super-analysis-types";
import { validateTranscriptStructure } from "@/lib/transcript-format";

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
