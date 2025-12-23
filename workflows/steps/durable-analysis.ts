import { getWritable } from "workflow";
import { updateTranscriptAnalysisSection } from "@/db/queries";
import type { YouTubeVideoId } from "@/lib/youtube-utils";
import type { AnalysisStreamEvent } from "./transcript-analysis";

/**
 * Saves a section of the analysis to the database and streams it to the client.
 */
export async function recordSection({
  videoId,
  key,
  content,
}: {
  videoId: string;
  key: string;
  content: unknown;
}) {
  "use step";

  const typedVideoId = videoId as YouTubeVideoId;

  console.log(`[${videoId}] Recording section: ${key}`);

  // Atomic update and fetch new result
  const newResult = await updateTranscriptAnalysisSection(
    typedVideoId,
    key,
    content,
  );

  // Emit to client
  // We use getWritable to get the stream for the current workflow run
  const writable = getWritable<AnalysisStreamEvent>();

  const writer = writable.getWriter();
  try {
    // We emit a "partial" event with the FULL result so far,
    // because the frontend likely expects the full object to update its state.
    await writer.write({ type: "partial", data: newResult });
  } catch (error) {
    console.warn(`[${videoId}] Failed to emit partial update:`, error);
  } finally {
    writer.releaseLock();
  }

  return `Section '${key}' recorded successfully.`;
}
