/**
 * Pure formatting utilities for video analysis data.
 * These functions are extracted from components for testability.
 */

import { isRecord } from "./type-utils";

/**
 * Converts snake_case or kebab-case to Title Case.
 * @example formatSectionTitle("key_takeaways") => "Key Takeaways"
 * @example formatSectionTitle("my-section") => "My Section"
 */
export function formatSectionTitle(key: string): string {
  if (!key || typeof key !== "string") {
    return "";
  }

  return key
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Converts various content types to markdown format.
 * Handles strings, arrays, and objects.
 */
export function contentToMarkdown(content: unknown): string {
  if (content === null || content === undefined || content === "") {
    return "_No content_";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    if (content.length === 0) {
      return "_No items_";
    }

    return content
      .map((item) => {
        if (typeof item === "string") {
          // Check if already starts with - * or numbered list
          return item.trim().match(/^\s*[-*]\s+|^\s*\d+\.\s+|^\s*\d+\)\s+/)
            ? item
            : `- ${item}`;
        }
        return `\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\``;
      })
      .join("\n");
  }

  if (isRecord(content)) {
    let markdown = "";

    for (const [key, value] of Object.entries(content)) {
      markdown += `**${key}**: `;

      if (typeof value === "string") {
        markdown += value;
      } else {
        markdown += `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
      }

      markdown += "\n\n";
    }

    return markdown;
  }

  return String(content);
}

/**
 * Converts an analysis object to markdown format.
 * Each top-level key becomes a section with an h2 header.
 */
export function analysisToMarkdown(analysis: Record<string, unknown>): string {
  let markdown = "";

  for (const [key, value] of Object.entries(analysis)) {
    markdown += `## ${formatSectionTitle(key)}\n\n`;

    markdown += contentToMarkdown(value);

    markdown += "\n\n";
  }

  return markdown.trim();
}
