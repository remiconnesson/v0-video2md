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

  console.log("Checking cached transcript for video", videoId);

  const cachedTranscriptData = await getTranscriptDataFromDb(videoId);

  if (cachedTranscriptData) {
    transcriptData = cachedTranscriptData;
    console.log("🤖 Found cached transcript for video", videoId);
  } else {
    console.log("🤖 No cached transcript found for video", videoId);
    console.log("🤖 Fetching transcript for video", videoId);
    const fetchedResult = await fetchYoutubeTranscriptFromApify(videoId);
    console.log("🤖 Saving transcript for video", videoId);
    await saveYoutubeTranscriptToDb(fetchedResult);
    // biome-ignore lint/style/noNonNullAssertion: we just inserted it into the db
    transcriptData = (await getTranscriptDataFromDb(videoId))!;
  }

  console.log("🤖 Analyzing transcript for video", videoId);
  const analysisResult = await doTranscriptAIAnalysis(transcriptData, writable);
  console.log("🤖 Saving analysis result for video", videoId);

  await saveTranscriptAIAnalysisToDb(videoId, analysisResult, writable);

  console.log("🤖 Analysis complete for video", videoId);

  return {
    success: true,
    title: transcriptData.title,
  };
}
