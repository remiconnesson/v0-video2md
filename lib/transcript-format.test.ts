import { describe, expect, it } from "vitest";
import {
  calculateTranscriptDuration,
  estimateWordCount,
  extractPlainText,
  formatTimestamp,
  formatTimestampForLLM,
  formatTranscriptForLLM,
} from "./transcript-format";

describe("formatTimestamp", () => {
  it("should format seconds only", () => {
    expect(formatTimestamp(45)).toBe("0:45");
    expect(formatTimestamp(5)).toBe("0:05");
  });

  it("should format minutes and seconds", () => {
    expect(formatTimestamp(125)).toBe("2:05");
    expect(formatTimestamp(600)).toBe("10:00");
  });

  it("should format hours, minutes, and seconds", () => {
    expect(formatTimestamp(3665)).toBe("1:01:05");
    expect(formatTimestamp(7200)).toBe("2:00:00");
  });

  it("should handle zero", () => {
    expect(formatTimestamp(0)).toBe("0:00");
  });

  it("should floor decimal values", () => {
    expect(formatTimestamp(45.9)).toBe("0:45");
  });
});

describe("formatTimestampForLLM", () => {
  it("should always include hours with padding", () => {
    expect(formatTimestampForLLM(45)).toBe("00:00:45");
    expect(formatTimestampForLLM(125)).toBe("00:02:05");
    expect(formatTimestampForLLM(3665)).toBe("01:01:05");
  });

  it("should handle zero", () => {
    expect(formatTimestampForLLM(0)).toBe("00:00:00");
  });
});

describe("formatTranscriptForLLM", () => {
  it("should format segments with timestamps", () => {
    const segments = [
      { start: 0, text: "Hello" },
      { start: 5, text: "World" },
    ];
    expect(formatTranscriptForLLM(segments)).toBe("[0:00] Hello\n[0:05] World");
  });

  it("should handle empty array", () => {
    expect(formatTranscriptForLLM([])).toBe("");
  });

  it("should handle long timestamps", () => {
    const segments = [{ start: 3665, text: "Long video" }];
    expect(formatTranscriptForLLM(segments)).toBe("[1:01:05] Long video");
  });
});

describe("calculateTranscriptDuration", () => {
  it("should return 0 for empty array", () => {
    expect(calculateTranscriptDuration([])).toBe(0);
  });

  it("should use end time of last segment if available", () => {
    const segments = [
      { start: 0, end: 5, text: "First" },
      { start: 5, end: 15, text: "Last" },
    ];
    expect(calculateTranscriptDuration(segments)).toBe(15);
  });

  it("should fallback to start time if no end", () => {
    const segments = [
      { start: 0, text: "First" },
      { start: 10, text: "Last" },
    ];
    expect(calculateTranscriptDuration(segments)).toBe(10);
  });
});

describe("extractPlainText", () => {
  it("should concatenate all text with spaces", () => {
    const segments = [
      { start: 0, text: "Hello" },
      { start: 5, text: "World" },
    ];
    expect(extractPlainText(segments)).toBe("Hello World");
  });

  it("should handle empty array", () => {
    expect(extractPlainText([])).toBe("");
  });
});

describe("estimateWordCount", () => {
  it("should count words in transcript", () => {
    const segments = [
      { start: 0, text: "Hello world" },
      { start: 5, text: "This is a test" },
    ];
    expect(estimateWordCount(segments)).toBe(6);
  });

  it("should handle empty array", () => {
    expect(estimateWordCount([])).toBe(0);
  });

  it("should handle multiple spaces", () => {
    const segments = [{ start: 0, text: "Hello   world" }];
    expect(estimateWordCount(segments)).toBe(2);
  });
});
