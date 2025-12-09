import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("should merge single class name", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("should merge multiple class names", () => {
    const result = cn("text-red-500", "bg-blue-500");
    expect(result).toContain("text-red-500");
    expect(result).toContain("bg-blue-500");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "active")).toBe("base active");
    expect(cn("base", false && "inactive")).toBe("base");
  });

  it("should merge conflicting Tailwind classes", () => {
    // tailwind-merge should keep the last class when conflicts occur
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("should handle arrays of classes", () => {
    const result = cn(["text-sm", "font-bold"]);
    expect(result).toContain("text-sm");
    expect(result).toContain("font-bold");
  });

  it("should handle objects with boolean values", () => {
    const result = cn({
      "text-red-500": true,
      "bg-blue-500": false,
      "font-bold": true,
    });
    expect(result).toContain("text-red-500");
    expect(result).not.toContain("bg-blue-500");
    expect(result).toContain("font-bold");
  });

  it("should handle undefined and null values", () => {
    expect(cn("base", undefined, null, "active")).toBe("base active");
  });

  it("should handle empty input", () => {
    expect(cn()).toBe("");
  });

  it("should handle complex combinations", () => {
    const result = cn(
      "base",
      ["text-sm", "font-bold"],
      { active: true, disabled: false },
      "final",
    );
    expect(result).toContain("base");
    expect(result).toContain("text-sm");
    expect(result).toContain("font-bold");
    expect(result).toContain("active");
    expect(result).not.toContain("disabled");
    expect(result).toContain("final");
  });

  it("should deduplicate identical classes", () => {
    const result = cn("text-red-500", "text-red-500");
    expect(result).toBe("text-red-500");
  });

  it("should handle whitespace correctly", () => {
    expect(cn("  text-sm  ", "  font-bold  ")).toContain("text-sm");
  });
});
