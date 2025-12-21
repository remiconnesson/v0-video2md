/**
 * Pure utility functions for transcript formatting.
 * Extracted from workflow steps for testability and reuse.
 */

import { formatDuration, toClockParts } from "./time-utils";

export interface TranscriptSegment {
  start: number;
  end?: number;
  text: string;
}

/**
 * Formats a timestamp in seconds to a human-readable string.
 * @param seconds - Number of seconds
 * @returns Formatted timestamp (e.g., "1:23" or "1:23:45")
 *
 * @example
 * formatTimestamp(83) => "1:23"
 * formatTimestamp(3723) => "1:02:03"
 */
export function formatTimestamp(seconds: number): string {
  return formatDuration(seconds);
}

/**
 * Formats a timestamp for LLM consumption (always HH:MM:SS).
 * @param seconds - Number of seconds
 * @returns Formatted timestamp with leading zeros (e.g., "00:01:23")
 */
export function formatTimestampForLLM(seconds: number): string {
  const { hours, mins, secs } = toClockParts(seconds);

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formats transcript segments into a string suitable for LLM analysis.
 * Each segment is prefixed with its timestamp.
 *
 * @param segments - Array of transcript segments
 * @returns Formatted transcript string with timestamps
 *
 * @example
 * formatTranscriptForLLM([
 *   { start: 0, text: "Hello" },
 *   { start: 5, text: "World" }
 * ])
 * // => "[0:00] Hello\n[0:05] World"
 */
export function formatTranscriptForLLM(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => `[${formatTimestamp(segment.start)}] ${segment.text}`)
    .join("\n");
}

/**
 * Calculates the total duration of a transcript.
 * @param segments - Array of transcript segments
 * @returns Total duration in seconds, or 0 if empty
 */
export function calculateTranscriptDuration(
  segments: TranscriptSegment[],
): number {
  if (segments.length === 0) return 0;

  const lastSegment = segments[segments.length - 1];
  return lastSegment.end ?? lastSegment.start;
}

/**
 * Extracts plain text from transcript segments.
 * @param segments - Array of transcript segments
 * @returns Concatenated text without timestamps
 */
export function extractPlainText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}

/**
 * Estimates word count from transcript segments.
 * @param segments - Array of transcript segments
 * @returns Approximate word count
 */
export function estimateWordCount(segments: TranscriptSegment[]): number {
  const text = extractPlainText(segments);
  return text.split(/\s+/).filter(Boolean).length;
}
