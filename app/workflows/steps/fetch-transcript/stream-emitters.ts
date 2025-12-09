import { getWritable } from "workflow";

// ============================================================================
// Stream Event Types
// ============================================================================

export type TranscriptStreamEvent =
  | { type: "progress"; progress: number; message: string }
  | { type: "complete"; video: { title: string; channelName: string } }
  | { type: "error"; error: string };

// ============================================================================
// Step: Emit progress
// ============================================================================

export async function emitProgress(progress: number, message: string) {
  "use step";

  const writable = getWritable<TranscriptStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", progress, message });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit completion
// ============================================================================

export async function emitComplete(video: {
  title: string;
  channelName: string;
}) {
  "use step";

  const writable = getWritable<TranscriptStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", video });
  writer.releaseLock();
  await writable.close();
}

// ============================================================================
// Step: Emit error
// ============================================================================

export async function emitError(error: string) {
  "use step";

  const writable = getWritable<TranscriptStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", error });
  writer.releaseLock();
  await writable.close();
}
