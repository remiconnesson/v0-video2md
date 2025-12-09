import { z } from "zod";

// ============================================================================
// Transcript Segment Schema (shared across transcript and analysis)
// ============================================================================

export const TranscriptSegmentSchema = z.object({
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
