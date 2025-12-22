import { describe, expect, it } from "vitest";

import {
  calculateTranscriptDuration,
  estimateWordCount,
  extractPlainText,
  formatTimestampForLLM,
  formatTranscriptForLLM,
  type TranscriptSegment,
  validateTranscriptStructure,
} from "./transcript-format";

describe("validateTranscriptStructure", () => {
  it("should validate a valid transcript structure", () => {
    const validTranscript = [
      { start: 0, end: 5, text: "Hello world" },
      { start: 5, end: 10, text: "This is a test" },
    ];

    const result = validateTranscriptStructure(validTranscript);

    expect(result).toEqual(validTranscript);
    expect(result).toHaveLength(2);
  });

  it("should throw error for invalid transcript structure", () => {
    const invalidTranscript = [{ start: 0, text: "Missing end field" }];

    expect(() => validateTranscriptStructure(invalidTranscript)).toThrow(
      "Invalid transcript structure",
    );
  });
});

describe("formatTimestampForLLM", () => {
  it("should handle zero seconds with HH:MM:SS format", () => {
    expect(formatTimestampForLLM(0)).toBe("00:00:00");
  });

  it("should format timestamp with hours, minutes, and seconds", () => {
    expect(formatTimestampForLLM(3665)).toBe("01:01:05");
  });
});

describe("formatTranscriptForLLM", () => {
  it("should format transcript segments with timestamps", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello" },
      { start: 5, end: 10, text: "World" },
    ];

    const result = formatTranscriptForLLM(segments);

    expect(result).toBe("[0:00] Hello\n[0:05] World");
  });

  it("should handle empty array", () => {
    const result = formatTranscriptForLLM([]);

    expect(result).toBe("");
  });

  it("should handle segments with empty text", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "" },
      { start: 5, end: 10, text: "Text" },
    ];

    const result = formatTranscriptForLLM(segments);

    expect(result).toBe("[0:00] \n[0:05] Text");
  });
});

describe("calculateTranscriptDuration", () => {
  it("should calculate duration from last segment end time", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "First" },
      { start: 5, end: 10, text: "Second" },
      { start: 10, end: 20, text: "Third" },
    ];

    const duration = calculateTranscriptDuration(segments);

    expect(duration).toBe(20);
  });

  it("should return 0 for empty array", () => {
    const duration = calculateTranscriptDuration([]);

    expect(duration).toBe(0);
  });
});

describe("extractPlainText", () => {
  it("should extract and concatenate text from segments", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello" },
      { start: 5, end: 10, text: "World" },
      { start: 10, end: 15, text: "Test" },
    ];

    const result = extractPlainText(segments);

    expect(result).toBe("Hello World Test");
  });

  it("should return empty string for empty array", () => {
    const result = extractPlainText([]);

    expect(result).toBe("");
  });
});

describe("estimateWordCount", () => {
  it("should count words in transcript segments", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello world" },
      { start: 5, end: 10, text: "This is a test" },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(6);
  });

  it("should return 0 for empty array", () => {
    const wordCount = estimateWordCount([]);

    expect(wordCount).toBe(0);
  });

  it("should handle multiple spaces between words", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello    World" },
      { start: 5, end: 10, text: "Multiple   Spaces" },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(4);
  });
});
