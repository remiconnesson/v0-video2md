import { describe, expect, it } from "vitest";
import { isRecord } from "./type-utils";

describe("isRecord", () => {
  it("should return true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1, b: 2 })).toBe(true);
    expect(isRecord({ key: "value" })).toBe(true);
  });

  it("should return true for objects with string keys", () => {
    expect(isRecord({ name: "test", age: 30 })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isRecord(undefined)).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2, 3])).toBe(false);
  });

  it("should return false for primitive types", () => {
    expect(isRecord("string")).toBe(false);
    expect(isRecord(123)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });

  it("should return false for functions", () => {
    expect(isRecord(() => {})).toBe(false);
  });

  it("should return true for objects created with Object.create", () => {
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it("should return true for class instances", () => {
    class TestClass {
      prop = "value";
    }
    expect(isRecord(new TestClass())).toBe(true);
  });
});
