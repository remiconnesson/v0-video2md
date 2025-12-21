import { describe, expect, it } from "vitest";
import { formatDuration } from "./time-utils";

describe("formatDuration", () => {
  it("should format seconds only", () => {
    expect(formatDuration(45)).toBe("0:45");
  });

  it("should format minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("should format hours, minutes, and seconds", () => {
    expect(formatDuration(3665)).toBe("1:01:05");
  });

  it("should pad single-digit seconds with zero", () => {
    expect(formatDuration(5)).toBe("0:05");
  });

  it("should pad single-digit minutes with zero when hours present", () => {
    expect(formatDuration(3605)).toBe("1:00:05");
  });

  it("should handle zero seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
  });

  it("should return N/A for null", () => {
    expect(formatDuration(null)).toBe("N/A");
  });

  it("should handle large durations", () => {
    expect(formatDuration(36000)).toBe("10:00:00"); // 10 hours
  });

  it("should floor decimal seconds", () => {
    expect(formatDuration(45.7)).toBe("0:45");
  });
});
