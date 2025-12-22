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
  it("should format timestamp with leading zeros for seconds only", () => {
    expect(formatTimestampForLLM(45)).toBe("00:00:45");
  });

  it("should format timestamp with leading zeros for minutes and seconds", () => {
    expect(formatTimestampForLLM(125)).toBe("00:02:05");
  });

  it("should format timestamp with hours, minutes, and seconds", () => {
    expect(formatTimestampForLLM(3665)).toBe("01:01:05");
  });

  it("should handle zero seconds with HH:MM:SS format", () => {
    expect(formatTimestampForLLM(0)).toBe("00:00:00");
  });

  it("should handle large durations with proper padding", () => {
    expect(formatTimestampForLLM(36000)).toBe("10:00:00");
  });

  it("should handle single digit hours with leading zero", () => {
    expect(formatTimestampForLLM(3600)).toBe("01:00:00");
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

  it("should format single segment", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Single segment" },
    ];

    const result = formatTranscriptForLLM(segments);

    expect(result).toBe("[0:00] Single segment");
  });

  it("should format timestamps correctly for longer durations", () => {
    const segments: TranscriptSegment[] = [
      { start: 3665, end: 3700, text: "After an hour" },
    ];

    const result = formatTranscriptForLLM(segments);

    expect(result).toBe("[1:01:05] After an hour");
  });

  it("should handle segments with empty text", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "" },
      { start: 5, end: 10, text: "Text" },
    ];

    const result = formatTranscriptForLLM(segments);

    expect(result).toBe("[0:00] \n[0:05] Text");
  });

  it("should preserve newlines and special characters in text", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Line 1\nLine 2" },
      { start: 5, end: 10, text: "Special: @#$%" },
    ];

    const result = formatTranscriptForLLM(segments);

    expect(result).toContain("Line 1\nLine 2");
    expect(result).toContain("Special: @#$%");
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

  it("should handle single segment", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 100, text: "Only one" },
    ];

    const duration = calculateTranscriptDuration(segments);

    expect(duration).toBe(100);
  });

  it("should use end time of last segment regardless of start times", () => {
    const segments: TranscriptSegment[] = [
      { start: 10, end: 20, text: "Not from zero" },
      { start: 20, end: 50, text: "Last one" },
    ];

    const duration = calculateTranscriptDuration(segments);

    expect(duration).toBe(50);
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

  it("should handle single segment", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Single" },
    ];

    const result = extractPlainText(segments);

    expect(result).toBe("Single");
  });

  it("should handle segments with empty text", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "" },
      { start: 5, end: 10, text: "Text" },
      { start: 10, end: 15, text: "" },
    ];

    const result = extractPlainText(segments);

    expect(result).toBe(" Text ");
  });

  it("should preserve spaces within segment text", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello  World" },
      { start: 5, end: 10, text: "Multiple   Spaces" },
    ];

    const result = extractPlainText(segments);

    expect(result).toBe("Hello  World Multiple   Spaces");
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

  it("should handle single word", () => {
    const segments: TranscriptSegment[] = [{ start: 0, end: 5, text: "Hello" }];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(1);
  });

  it("should handle multiple spaces between words", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello    World" },
      { start: 5, end: 10, text: "Multiple   Spaces" },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(4);
  });

  it("should filter out empty strings from word count", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "   " },
      { start: 5, end: 10, text: "Word1 Word2" },
      { start: 10, end: 15, text: "" },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(2);
  });

  it("should handle segments with only whitespace", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "   \n  \t  " },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(0);
  });

  it("should count hyphenated words as single words", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "well-known state-of-the-art" },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(2);
  });

  it("should handle punctuation attached to words", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Hello, world! How are you?" },
    ];

    const wordCount = estimateWordCount(segments);

    expect(wordCount).toBe(5);
  });
});
