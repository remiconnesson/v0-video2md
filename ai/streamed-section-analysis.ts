/**
 * Streamed Section Analysis
 *
 * This module implements durable transcript analysis by streaming sections
 * one at a time. Each section is saved to the database as soon as it's generated,
 * so if the workflow times out, already-completed sections persist.
 *
 * Uses AI SDK's streamText with a tool that the model calls for each section.
 */

import { streamText, tool } from "ai";
import { z } from "zod";
import { incrementCompletedSections, saveAnalysisSection } from "@/db/queries";

// ============================================================================
// Types
// ============================================================================

export interface StreamedAnalysisInput {
  videoId: string;
  title: string;
  channelName?: string;
  description?: string;
  transcript: string;
}

export interface SectionEmitArgs {
  sectionKey: string;
  sectionTitle: string | null;
  markdown: string;
  sectionOrder: number;
}

export type OnSectionEmitted = (
  section: SectionEmitArgs,
) => void | Promise<void>;

// ============================================================================
// System Prompt for Section Streaming
// ============================================================================

const STREAMED_ANALYSIS_SYSTEM_PROMPT = `
You are an expert at analyzing video transcripts and extracting genuinely USEFUL information.

## Your Task

You will be given a transcript. Analyze it and output your analysis by calling the \`emit_section\` tool for EACH section you want to include. Call the tool multiple times, once per section.

## Your Goal: Be USEFUL

The best analysis saves time and helps retain/use what was learned. Ask yourself:
- "If I watched this video, what would I want to reference later?"
- "What insights might I miss on first viewing?"
- "How can I make this content actionable?"

## Required Sections (emit in this order)

1. **tldr** - Concise summary (2-3 sentences max)
2. **detailed_summary** - Comprehensive summary with markdown headers for structure
3. **transcript_corrections** - Likely transcription errors (if any)

## Optional Sections (choose what's valuable for this content)

- **key_takeaways** - Main points to remember
- **actionable_insights** - Concrete actions to take
- **quotes** - Notable quotations worth preserving (with context)
- **mermaid_diagram** - Visual representation (use \`\`\`mermaid code block)
- **facts** - Verifiable facts mentioned
- **stories** - Narratives or anecdotes (often the most memorable parts)
- **frameworks** - Mental models, methodologies, or tools discussed
- **products_mentioned** - Tools, books, resources referenced
- **problems_solved** - Problems addressed (what -> why it matters -> solution)
- **reflection_questions** - Questions for self-reflection/application
- **counterarguments** - Opposing viewpoints mentioned or worth considering
- **prerequisites** - What you need to know/have before applying this
- **related_topics** - What to explore next
- **key_moments** - Timestamps of important moments worth rewatching

**Invent your own sections!** If this is a cooking video, maybe "ingredients" and "technique_tips". If it's a debate, maybe "argument_structure" and "logical_fallacies". Match the content.

## Rules

- Use snake_case for section keys (e.g., "key_takeaways", "action_items")
- Only include sections that are genuinely valuable for THIS content
- Quality over quantity - 5 great sections beats 15 mediocre ones
- Use markdown extensively in the markdown field (bold, italic, headers, lists, code blocks)
- For mermaid diagrams, use simple alphanumeric node IDs and <br/> instead of \\n
- Include timestamps (MM:SS or HH:MM:SS) where relevant
- Call emit_section for EACH section, in order (sectionOrder starts at 1)

## Example Tool Calls

First call:
emit_section({ sectionKey: "tldr", sectionTitle: "TL;DR", markdown: "Brief summary...", sectionOrder: 1 })

Second call:
emit_section({ sectionKey: "detailed_summary", sectionTitle: "Detailed Summary", markdown: "## Overview\\n...", sectionOrder: 2 })

And so on for each section you want to include.
`.trim();

// ============================================================================
// Tool Schema
// ============================================================================

const emitSectionSchema = z.object({
  sectionKey: z
    .string()
    .describe(
      "Unique key for this section (snake_case, e.g., 'key_takeaways')",
    ),
  sectionTitle: z
    .string()
    .nullable()
    .describe("Human-readable title for the section (e.g., 'Key Takeaways')"),
  markdown: z.string().describe("The section content in markdown format"),
  sectionOrder: z
    .number()
    .int()
    .positive()
    .describe("Order of this section in the output (1, 2, 3, ...)"),
});

type EmitSectionInput = z.infer<typeof emitSectionSchema>;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Streams transcript analysis section by section.
 *
 * Each section is saved to the database as the tool is called,
 * providing durability even if the overall process times out.
 *
 * @param input - Video and transcript data
 * @param onSectionEmitted - Callback fired after each section is saved (for streaming to client)
 */
export function streamSectionAnalysis(
  input: StreamedAnalysisInput,
  onSectionEmitted?: OnSectionEmitted,
) {
  const userPrompt = buildUserPrompt(input);

  return streamText({
    model: "openai/gpt-5.1",
    system: STREAMED_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    toolChoice: "required", // Force the model to use tools
    tools: {
      emit_section: tool({
        description:
          "Emit a completed analysis section. Call this for each section.",
        inputSchema: emitSectionSchema,
        execute: async (args: EmitSectionInput) => {
          // Save to database immediately
          await saveAnalysisSection(input.videoId, {
            sectionKey: args.sectionKey,
            sectionTitle: args.sectionTitle,
            markdown: args.markdown,
            sectionOrder: args.sectionOrder,
          });

          // Increment the completed sections counter
          await incrementCompletedSections(input.videoId);

          // Notify callback if provided
          if (onSectionEmitted) {
            await onSectionEmitted(args);
          }

          // Return confirmation (model sees this)
          return { success: true, sectionKey: args.sectionKey };
        },
      }),
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

function buildUserPrompt(input: StreamedAnalysisInput): string {
  const parts: string[] = [];

  parts.push(`# Video: ${input.title}`);

  if (input.channelName) {
    parts.push(`**Channel**: ${input.channelName}`);
  }

  if (input.description) {
    parts.push(`## Description\n${input.description}`);
  }

  parts.push(`## Transcript\n\`\`\`\n${input.transcript}\n\`\`\``);

  parts.push(
    `\nAnalyze this transcript. Think about what would be genuinely USEFUL to extract, then call emit_section for each section you want to include. Start with tldr, then detailed_summary, then any other relevant sections.`,
  );

  return parts.join("\n\n");
}
