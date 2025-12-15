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
  console.log("[fetchAndSaveTranscript] 1. Start, videoId:", videoId);

  const cachedTranscriptData = await getTranscriptDataFromDb(videoId);
  console.log("[fetchAndSaveTranscript] 2. Cached:", !!cachedTranscriptData);

  let transcriptData: TranscriptData | null;

  if (cachedTranscriptData) {
    transcriptData = cachedTranscriptData;
  } else {
    console.log("[fetchAndSaveTranscript] 3. Fetching from Apify...");
    const fetchedResult = await fetchYoutubeTranscriptFromApify(videoId);
    console.log("[fetchAndSaveTranscript] 4. Saving to DB...");
    await saveYoutubeTranscriptToDb(fetchedResult);
    // biome-ignore lint/style/noNonNullAssertion: we know the transcript data is not null
    transcriptData = (await getTranscriptDataFromDb(videoId))!;
  }

  console.log("[fetchAndSaveTranscript] 5. Returning:", transcriptData?.title);
  return transcriptData;
}
