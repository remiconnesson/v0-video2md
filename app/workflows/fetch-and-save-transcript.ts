import {
  fetchYoutubeTranscriptFromApify,
  saveYoutubeTranscriptToDb,
} from "./steps/fetch-transcript";
import {
  getTranscriptDataFromDb,
  type TranscriptData,
} from "./steps/transcript-analysis";

export async function fetchAndSaveTranscriptWorkflow(videoId: string) {
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

  return transcriptData;
}
