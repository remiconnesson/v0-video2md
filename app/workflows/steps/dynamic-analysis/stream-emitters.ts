import { getWritable } from "workflow";

// ============================================================================
// Stream Event Types
// ============================================================================

export type AnalysisStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "partial"; data: unknown }
  | { type: "result"; data: unknown }
  | { type: "complete"; runId: number }
  | { type: "error"; message: string };

// ============================================================================
// Step: Emit progress
// ============================================================================

export async function emitProgress(phase: string, message: string) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "progress", phase, message });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit result
// ============================================================================

export async function emitResult(data: unknown) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "result", data });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit partial result
// ============================================================================

export async function emitPartialResult(data: unknown) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "partial", data });
  writer.releaseLock();
}

// ============================================================================
// Step: Emit completion
// ============================================================================

export async function emitComplete(runId: number) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "complete", runId });
  writer.releaseLock();
  await writable.close();
}

// ============================================================================
// Step: Emit error
// ============================================================================

export async function emitError(message: string) {
  "use step";

  const writable = getWritable<AnalysisStreamEvent>();
  const writer = writable.getWriter();
  await writer.write({ type: "error", message });
  writer.releaseLock();
  await writable.close();
}
