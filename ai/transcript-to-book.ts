import { generateObject } from "ai";
import { TRANSCRIPT_TO_BOOK_SYSTEM_PROMPT } from "./transcript-to-book-prompt";
import {
  type TranscriptToBook,
  transcriptToBookSchema,
} from "./transcript-to-book-schema";

export interface TranscriptToBookInput {
  transcriptString: string;
  title: string;
  description?: string;
  channelName?: string;
}

/**
 * Generates a book-style transformation of a video transcript.
 * Uses generateObject for structured output.
 *
 * NOTE: When calling from a Vercel Workflow step, ensure globalThis.fetch
 * is set to the workflow fetch before calling this function.
 */
export async function generateTranscriptToBook(
  input: TranscriptToBookInput,
): Promise<TranscriptToBook> {
  const { transcriptString, title, description, channelName } = input;
  const userPrompt = buildUserPrompt({
    title,
    description,
    channelName,
    transcriptString,
  });

  const result = await generateObject({
    model: "openai/gpt-5-mini",
    schema: transcriptToBookSchema,
    system: TRANSCRIPT_TO_BOOK_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}

function buildUserPrompt(input: {
  title: string;
  description?: string;
  channelName?: string;
  transcriptString: string;
}): string {
  const parts: string[] = [];

  parts.push(`# Video: ${input.title}`);

  if (input.channelName) {
    parts.push(`**Channel**: ${input.channelName}`);
  }

  if (input.description) {
    parts.push(`## Description\n${input.description}`);
  }

  parts.push(`## Transcript\n\`\`\`\n${input.transcriptString}\n\`\`\``);

  parts.push(
    `\nTransform this transcript into a book-quality long-form article.`,
  );

  return parts.join("\n\n");
}

export type { Chapter, TranscriptToBook } from "./transcript-to-book-schema";
