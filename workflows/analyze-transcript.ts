import { getWritable } from "workflow";
import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "./steps/fetch-transcript";
import {
  type AnalysisStreamEvent,
  doTranscriptAIAnalysis,
  getTranscriptDataFromDb,
  saveTranscriptAIAnalysisToDb,
  type TranscriptData,
} from "./steps/transcript-analysis";

export async function analyzeTranscriptWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<AnalysisStreamEvent>();
  let transcriptData: TranscriptData | null;

  const cachedTranscriptData = await getTranscriptDataFromDb(videoId);

  if (cachedTranscriptData) {
    transcriptData = cachedTranscriptData;
  } else {
    const fetchedResult = await fetchYoutubeTranscriptFromApify(videoId);
    await saveYoutubeTranscriptToDb(fetchedResult);
    // biome-ignore lint/style/noNonNullAssertion: we just inserted it into the db
    transcriptData = (await getTranscriptDataFromDb(videoId))!;
  }

  const analysisResult = await doTranscriptAIAnalysis(transcriptData, writable);

  await saveTranscriptAIAnalysisToDb(videoId, analysisResult, writable);

  return {
    success: true,
    title: transcriptData.title,
  };
}
