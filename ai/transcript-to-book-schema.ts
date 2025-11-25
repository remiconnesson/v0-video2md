import { z } from "zod";

export const chapterSchema = z.object({
  start: z
    .string()
    .describe(
      'Timestamp marking the beginning of this chapter in "MM:SS" or "HH:MM:SS" format.',
    ),
  chapterTitle: z
    .string()
    .describe(
      "A compelling, descriptive title for this chapter. Should work as a section header in a long-form article.",
    ),
  chapterSummary: z
    .string()
    .describe(
      "A 1-2 sentence summary of what this chapter covers. Helps readers decide if they want to read the full chapter.",
    ),
  bookChapter: z
    .string()
    .describe(
      "The full prose content of this chapter. Written in an engaging, readable style like a high-quality long-form article. Should flow naturally from the previous chapter and into the next. Use markdown formatting for emphasis and structure within the chapter.",
    ),
});

export const transcriptToBookSchema = z.object({
  videoSummary: z
    .string()
    .describe(
      "A compelling 2-3 paragraph summary of the entire video. Sets up the context and hooks the reader. Should work as an introduction to the book-style content.",
    ),
  chapters: z
    .array(chapterSchema)
    .describe(
      "Ordered array of chapters that together form a cohesive long-form article. Each chapter should flow naturally into the next. Aim for logical breakpoints based on topic shifts in the transcript.",
    ),
});

export type Chapter = z.infer<typeof chapterSchema>;
export type TranscriptToBook = z.infer<typeof transcriptToBookSchema>;
