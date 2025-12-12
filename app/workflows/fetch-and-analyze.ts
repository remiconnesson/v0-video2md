import {
  doTranscriptAIAnalysis,
  getTranscriptDataFromDb,
  saveTranscriptAIAnalysisToDb,
  type TranscriptData,
} from "./steps/dynamic-analysis";
import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "./steps/fetch-transcript";

export async function fetchAndAnalyzeWorkflow(
  videoId: string,
  version: number,
  additionalInstructions?: string,
) {
  "use workflow";

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

  const analysisResult = await doTranscriptAIAnalysis(
    transcriptData,
    additionalInstructions,
  );

  await saveTranscriptAIAnalysisToDb(videoId, analysisResult, version);

  return {
    success: true,
    title: transcriptData.title,
  };
}
