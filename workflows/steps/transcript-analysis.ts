import { streamDynamicAnalysis } from "@/ai/dynamic-analysis";
import { getVideoWithTranscript, saveTranscriptAnalysis } from "@/db/queries";
import { emit } from "@/lib/stream-utils";
import { formatTranscriptForLLM, validateTranscriptStructure } from "@/lib/transcript-format";

// ============================================================================
// Transcript Data Interface
// ============================================================================

export interface TranscriptData {
  videoId: string;
  title: string;
  channelName: string;
  description: string | null;
  transcript: string;
}

// ============================================================================
// Step: Fetch transcript data from DB
// ============================================================================

export async function getTranscriptDataFromDb(
  videoId: string,
): Promise<TranscriptData | null> {
  "use step";

  const transcriptRow = await getVideoWithTranscript(videoId);

  if (!transcriptRow) {
    return null;
  }

  const transcriptSegments = validateTranscriptStructure(
    transcriptRow.transcript,
  );

  return {
    ...transcriptRow,
    transcript: formatTranscriptForLLM(transcriptSegments),
  };
}

export async function saveTranscriptAIAnalysisToDb(
  videoId: string,
  result: Record<string, unknown>,
  writable: WritableStream<AnalysisStreamEvent>,
) {
  "use step";

  await saveTranscriptAnalysis(videoId, result);

  await emit<AnalysisStreamEvent>(
    { type: "result", data: result },
    writable,
    true,
  );
}

export async function doTranscriptAIAnalysis(
  transcriptData: TranscriptData,
  writable: WritableStream<AnalysisStreamEvent>,
) {
  "use step";

  const analysisStream = streamDynamicAnalysis({
    title: transcriptData.title,
    channelName: transcriptData.channelName,
    description: transcriptData.description ?? undefined,
    transcript: transcriptData.transcript,
  });

  for await (const partialResult of analysisStream.partialObjectStream) {
    await emit<AnalysisStreamEvent>(
      { type: "partial", data: partialResult },
      writable,
    );
  }

  const finalAnalysisResult = await analysisStream.object;

  return finalAnalysisResult as Record<string, unknown>;
}

export type AnalysisStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "partial"; data: unknown }
  | { type: "result"; data: unknown }
  | { type: "complete"; runId: number }
  | { type: "error"; message: string };
