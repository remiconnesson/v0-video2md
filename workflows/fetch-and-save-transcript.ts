import { sleep } from "workflow";
import {
  checkApifyExtractionStatus,
  fetchAndSaveApifyTranscript,
  startApifyTranscriptExtraction,
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
    const { runId, defaultDatasetId } =
      await startApifyTranscriptExtraction(videoId);

    while (true) {
      const { status } = await checkApifyExtractionStatus(runId);
      if (status === "SUCCEEDED") {
        break;
      }
      if (
        status === "FAILED" ||
        status === "ABORTED" ||
        status === "TIMED_OUT"
      ) {
        throw new Error(`Apify run failed with status: ${status}`);
      }
      await sleep(5);
    }

    console.log("[fetchAndSaveTranscript] 4. Saving to DB...");
    await fetchAndSaveApifyTranscript(runId, defaultDatasetId);
    // biome-ignore lint/style/noNonNullAssertion: we know the transcript data is not null
    transcriptData = (await getTranscriptDataFromDb(videoId))!;
  }

  console.log("[fetchAndSaveTranscript] 5. Returning:", transcriptData?.title);
  return transcriptData;
}
