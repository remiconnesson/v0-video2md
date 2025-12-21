import { describe, expect, it } from "vitest";

import {
  analysisToMarkdown,
  contentToMarkdown,
  formatSectionTitle,
  sectionToMarkdown,
} from "./analysis-format";

describe("formatSectionTitle", () => {
  it("should convert snake_case to Title Case", () => {
    expect(formatSectionTitle("key_takeaways")).toBe("Key Takeaways");
    expect(formatSectionTitle("action_items")).toBe("Action Items");
    expect(formatSectionTitle("tldr")).toBe("Tldr");
  });

  it("should convert kebab-case to Title Case", () => {
    expect(formatSectionTitle("key-takeaways")).toBe("Key Takeaways");
    expect(formatSectionTitle("my-section")).toBe("My Section");
  });

  it("should handle single words", () => {
    expect(formatSectionTitle("summary")).toBe("Summary");
    expect(formatSectionTitle("facts")).toBe("Facts");
  });

  it("should return empty string for empty input", () => {
    expect(formatSectionTitle("")).toBe("");
  });

  it("should return empty string for null/undefined", () => {
    expect(formatSectionTitle(null as unknown as string)).toBe("");
    expect(formatSectionTitle(undefined as unknown as string)).toBe("");
  });

  it("should handle multiple underscores", () => {
    expect(formatSectionTitle("my_long_section_name")).toBe(
      "My Long Section Name",
    );
  });
});

describe("contentToMarkdown", () => {
  it("should return _No content_ for null/undefined/empty", () => {
    expect(contentToMarkdown(null)).toBe("_No content_");
    expect(contentToMarkdown(undefined)).toBe("_No content_");
    expect(contentToMarkdown("")).toBe("_No content_");
  });

  it("should return string content as-is", () => {
    expect(contentToMarkdown("Hello world")).toBe("Hello world");
    expect(contentToMarkdown("**bold** text")).toBe("**bold** text");
  });

  it("should return _No items_ for empty array", () => {
    expect(contentToMarkdown([])).toBe("_No items_");
  });

  it("should convert string array to bullet list", () => {
    const result = contentToMarkdown(["item 1", "item 2", "item 3"]);
    expect(result).toBe("- item 1\n- item 2\n- item 3");
  });

  it("should not add bullet to items already starting with bullet", () => {
    const result = contentToMarkdown(["- item 1", "* item 2", "item 3"]);
    expect(result).toBe("- item 1\n* item 2\n- item 3");
  });

  it("should not add bullet to numbered list items", () => {
    const result = contentToMarkdown(["1. first", "2) second", "third"]);
    expect(result).toBe("1. first\n2) second\n- third");
  });

  it("should convert object array items to JSON blocks", () => {
    const result = contentToMarkdown([{ name: "test" }]);
    expect(result).toContain("```json");
    expect(result).toContain('"name": "test"');
    expect(result).toContain("```");
  });

  it("should convert object to key-value markdown", () => {
    const result = contentToMarkdown({ name: "John", age: "30" });
    expect(result).toContain("**name**: John");
    expect(result).toContain("**age**: 30");
  });

  it("should convert object with non-string values to JSON", () => {
    const result = contentToMarkdown({ data: { nested: true } });
    expect(result).toContain("**data**:");
    expect(result).toContain("```json");
  });

  it("should convert numbers to string", () => {
    expect(contentToMarkdown(42)).toBe("42");
  });

  it("should convert booleans to string", () => {
    expect(contentToMarkdown(true)).toBe("true");
    expect(contentToMarkdown(false)).toBe("false");
  });
});

describe("analysisToMarkdown", () => {
  it("should convert analysis object to markdown with headers", () => {
    const analysis = {
      tldr: "This is the summary",
      key_takeaways: ["Point 1", "Point 2"],
    };
    const result = analysisToMarkdown(analysis);
    expect(result).toContain("## Tldr");
    expect(result).toContain("This is the summary");
    expect(result).toContain("## Key Takeaways");
    expect(result).toContain("- Point 1");
    expect(result).toContain("- Point 2");
  });

  it("should handle empty analysis object", () => {
    expect(analysisToMarkdown({})).toBe("");
  });

  it("should handle nested objects", () => {
    const analysis = {
      metadata: {
        title: "Test",
        duration: "10:00",
      },
    };
    const result = analysisToMarkdown(analysis);
    expect(result).toContain("## Metadata");
    expect(result).toContain("**title**: Test");
    expect(result).toContain("**duration**: 10:00");
  });

  it("should handle mixed content types", () => {
    const analysis = {
      summary: "A summary",
      items: ["item 1", "item 2"],
      details: { key: "value" },
    };
    const result = analysisToMarkdown(analysis);
    expect(result).toContain("## Summary");
    expect(result).toContain("A summary");
    expect(result).toContain("## Items");
    expect(result).toContain("- item 1");
    expect(result).toContain("## Details");
    expect(result).toContain("**key**: value");
  });
});

describe("sectionToMarkdown", () => {
  it("should convert a section with string content to markdown", () => {
    const result = sectionToMarkdown("tldr", "This is a summary");
    expect(result).toBe("## Tldr\n\nThis is a summary");
  });

  it("should convert a section with array content to markdown", () => {
    const result = sectionToMarkdown("key_takeaways", ["Point 1", "Point 2"]);
    expect(result).toContain("## Key Takeaways");
    expect(result).toContain("- Point 1");
    expect(result).toContain("- Point 2");
  });

  it("should convert a section with object content to markdown", () => {
    const result = sectionToMarkdown("metadata", {
      title: "Test",
      duration: "10:00",
    });
    expect(result).toContain("## Metadata");
    expect(result).toContain("**title**: Test");
    expect(result).toContain("**duration**: 10:00");
  });

  it("should handle empty content", () => {
    const result = sectionToMarkdown("empty_section", null);
    expect(result).toContain("## Empty Section");
    expect(result).toContain("_No content_");
  });

  it("should format section title correctly", () => {
    const result = sectionToMarkdown("my_custom_section", "content");
    expect(result).toContain("## My Custom Section");
  });
});
