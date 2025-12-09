import { describe, expect, it } from "vitest";

import { parseDuration } from "@/lib/time-utils";

describe("parseDuration", () => {
  describe("MM:SS format", () => {
    it("should parse simple minutes and seconds", () => {
      expect(parseDuration("5:30")).toBe(330); // 5*60 + 30
      expect(parseDuration("10:00")).toBe(600);
      expect(parseDuration("0:45")).toBe(45);
    });

    it("should parse single digit values", () => {
      expect(parseDuration("1:5")).toBe(65); // 1*60 + 5
      expect(parseDuration("0:0")).toBe(0);
    });

    it("should parse double digit seconds", () => {
      expect(parseDuration("2:59")).toBe(179);
    });
  });

  describe("HH:MM:SS format", () => {
    it("should parse hours, minutes, and seconds", () => {
      expect(parseDuration("1:30:00")).toBe(5400); // 1*3600 + 30*60
      expect(parseDuration("2:15:45")).toBe(8145); // 2*3600 + 15*60 + 45
    });

    it("should handle zero hours", () => {
      expect(parseDuration("0:10:30")).toBe(630);
    });

    it("should handle large hour values", () => {
      expect(parseDuration("10:00:00")).toBe(36000);
    });
  });

  describe("edge cases", () => {
    it("should return null for undefined", () => {
      expect(parseDuration(undefined)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseDuration("")).toBeNull();
    });

    it("should handle whitespace", () => {
      expect(parseDuration(" 5:30 ")).toBe(330);
    });

    it("should return null for invalid format - single part", () => {
      expect(parseDuration("300")).toBeNull();
    });

    it("should return null for invalid format - four parts", () => {
      expect(parseDuration("1:2:3:4")).toBeNull();
    });

    it("should return null for non-numeric parts", () => {
      expect(parseDuration("a:30")).toBeNull();
      expect(parseDuration("5:b")).toBeNull();
    });

    it("should return null for negative values", () => {
      expect(parseDuration("-5:30")).toBeNull();
    });

    it("should return null for values > 255", () => {
      expect(parseDuration("300:30")).toBeNull();
    });
  });
});
