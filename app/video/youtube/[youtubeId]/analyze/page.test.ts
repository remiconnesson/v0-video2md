import { describe, expect, it } from "vitest";
import { parseVersion } from "./page";

describe("parseVersion", () => {
  it("should return undefined for undefined input", () => {
    expect(parseVersion(undefined)).toBeUndefined();
  });

  it("should parse valid version string", () => {
    expect(parseVersion("1")).toBe(1);
    expect(parseVersion("5")).toBe(5);
    expect(parseVersion("100")).toBe(100);
  });

  it("should throw error for version less than 1", () => {
    expect(() => parseVersion("0")).toThrow(
      "Version must be greater than or equal to 1",
    );
    expect(() => parseVersion("-1")).toThrow(
      "Version must be greater than or equal to 1",
    );
    expect(() => parseVersion("-10")).toThrow(
      "Version must be greater than or equal to 1",
    );
  });

  it("should handle string with leading zeros", () => {
    expect(parseVersion("01")).toBe(1);
    expect(parseVersion("005")).toBe(5);
  });

  it("should handle edge case of version 1", () => {
    expect(parseVersion("1")).toBe(1);
  });
});
