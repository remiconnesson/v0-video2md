import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration } from "./time-utils";

describe("formatDuration", () => {
  it("should format seconds only", () => {
    expect(formatDuration(45)).toBe("0:45");
  });

  it("should format hours, minutes, and seconds", () => {
    expect(formatDuration(3665)).toBe("1:01:05");
  });

  it("should pad single-digit seconds with zero", () => {
    expect(formatDuration(5)).toBe("0:05");
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

describe("parseDuration", () => {
  it("should return null for undefined or empty input", () => {
    expect(parseDuration(undefined)).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  it("should return null for invalid formats", () => {
    expect(parseDuration("123")).toBeNull(); // No colon
    expect(parseDuration("1:2:3:4")).toBeNull(); // Too many parts
    expect(parseDuration("abc")).toBeNull(); // Non-numeric
    expect(parseDuration("10:xx")).toBeNull(); // Non-numeric part
  });

  it("should parse MM:SS format", () => {
    expect(parseDuration("10:30")).toBe(10 * 60 + 30);
    expect(parseDuration("0:45")).toBe(45);
  });

  it("should parse HH:MM:SS format", () => {
    expect(parseDuration("1:00:00")).toBe(3600);
    expect(parseDuration("01:01:05")).toBe(3665);
  });

  it("should return null if minutes > 255 in MM:SS format", () => {
    expect(parseDuration("256:00")).toBeNull();
  });

  it("should return null for negative numbers", () => {
    expect(parseDuration("-10:30")).toBeNull();
  });

  it("should handle floating point numbers by flooring (implied by implementation)", () => {
    // The implementation seems to allow float parsing but then checks for integers after floor?
    // Actually looking at code:
    // const flooredValue = Math.floor(numericValue);
    // return Number.isInteger(flooredValue) ? flooredValue : null;
    // Wait, Math.floor always returns an integer (or NaN/-Infinity/Infinity).
    // But numericValue check !Number.isFinite(numericValue) handles Infinity.
    // So Math.floor(numericValue) will be an integer.
    // So this effectively allows floats but treats them as their floor.
    expect(parseDuration("10.5:30")).toBe(10 * 60 + 30);
  });
});
