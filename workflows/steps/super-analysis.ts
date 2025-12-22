import { z } from "zod";
import {
  getCompletedAnalysis,
  getSlideAnalysisResults,
  getVideoSlides,
  getVideoWithTranscript,
} from "@/db/queries";
import type { SuperAnalysisInputData } from "@/lib/super-analysis-types";

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
