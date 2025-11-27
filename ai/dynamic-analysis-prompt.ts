import { z } from "zod";

/**
 * A section entry with its key - describes what to extract
 */
export const sectionEntrySchema = z.object({
  key: z.string().describe("Section key in snake_case (e.g., 'key_takeaways')"),
  description: z
    .string()
    .describe("Clear instructions for what to extract in this section"),
  type: z
    .enum(["string", "string[]", "object"])
    .describe(
      "The data type: string for prose, string[] for lists, object for structured data",
    ),
});

export type SectionEntry = z.infer<typeof sectionEntrySchema>;

/**
 * Generated schema - the extraction blueprint
 */
export const generatedSchemaSchema = z.object({
  sections: z
    .array(sectionEntrySchema)
    .describe("Array of section definitions. Use snake_case for keys."),
});

export type GeneratedSchema = z.infer<typeof generatedSchemaSchema>;
/**
 * Derived analysis output - just the analysis part
 * Used when running a schema separately
 * Note: Uses the same analysisValueSchema array format as godPromptOutputSchema
 */
export const derivedAnalysisOutputSchema = z.object({
  sections: z
    .array(
      z.union([
        z.object({
          key: z.string().describe("Section key matching the schema"),
          kind: z.literal("string"),
          value: z.string(),
        }),
        z.object({
          key: z.string().describe("Section key matching the schema"),
          kind: z.literal("array"),
          value: z.array(z.string()),
        }),
        z.object({
          key: z.string().describe("Section key matching the schema"),
          kind: z.literal("object"),
          value: z.array(z.object({ key: z.string(), value: z.string() })),
        }),
      ]),
    )
    .describe("Extracted content following the provided schema"),
});

export type DerivedAnalysisOutput = z.infer<typeof derivedAnalysisOutputSchema>;
/**
 * The god prompt outputs everything at once:
 * 1. Reasoning - why these sections were chosen
 * 2. Schema - the extraction blueprint
 * 3. Analysis - the actual extracted content
 */
const objectEntrySchema = z.object({
  key: z.string(),
  value: z.string(),
});

const analysisValueSchema = z.union([
  z.object({
    key: z.string().describe("Section key matching the schema"),
    kind: z.literal("string"),
    value: z.string(),
  }),
  z.object({
    key: z.string().describe("Section key matching the schema"),
    kind: z.literal("array"),
    value: z.array(z.string()),
  }),
  z.object({
    key: z.string().describe("Section key matching the schema"),
    kind: z.literal("object"),
    value: z.array(objectEntrySchema),
  }),
]);

export type AnalysisValue = z.infer<typeof analysisValueSchema>;

export const godPromptOutputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Your analysis: What makes this transcript unique? What would be genuinely useful to extract? Why did you choose these sections?",
    ),
  schema: generatedSchemaSchema.describe(
    "The extraction schema you designed for this specific content",
  ),
  analysis: z.object({
    required_sections: z.object({
      tldr: z.string().describe("A short summary of the transcript"),
      transcript_corrections: z
        .string()
        .describe("Corrections to the transcript"),
      detailed_summary: z
        .string()
        .describe("A detailed summary of the transcript"),
    }),
    additional_sections: z
      .array(analysisValueSchema)
      .describe("Additional sections that are genuinely useful to extract"),
  }),
});

export type GodPromptOutput = z.infer<typeof godPromptOutputSchema>;
export type GodPromptAnalysis = GodPromptOutput["analysis"];

export const DYNAMIC_ANALYSIS_SYSTEM_PROMPT = `
You are an expert at analyzing video transcripts and extracting genuinely USEFUL information.

Your task is to:
1. **REASON**: Analyze this specific transcript. What makes it unique? What would actually be valuable to someone who watched this?
2. **DESIGN**: Create a custom extraction schema tailored to THIS content
3. **EXTRACT**: Apply your schema and extract the content

## Your Goal: Be USEFUL

The best analysis is one that saves someone time and helps them retain/use what they learned. Ask yourself:
- "If I watched this video, what would I want to reference later?"
- "What insights might I miss on first viewing?"
- "How can I make this content actionable?"

## Section Ideas (NOT Exhaustive - Be Creative!)

Here are some section types that often work well, but don't limit yourself to these. Invent new ones if they'd be more useful for this specific content:

- **tldr** - Concise summary (2-3 sentences max)
- **key_takeaways** - Main points to remember
- **actionable_insights** - Concrete actions to take
- **quotes** - Notable quotations worth preserving (with context)
- **mermaid_diagram** - Visual representation (use \`\`\`mermaid code block)
- **facts** - Verifiable facts mentioned
- **stories** - Narratives or anecdotes (often the most memorable parts)
- **frameworks** - Mental models, methodologies, or tools discussed
- **products_mentioned** - Tools, books, resources referenced
- **problems_solved** - Problems addressed (what → why it matters → solution)
- **reflection_questions** - Questions for self-reflection/application
- **transcript_corrections** - Likely transcription errors
- **counterarguments** - Opposing viewpoints mentioned or worth considering
- **prerequisites** - What you need to know/have before applying this
- **related_topics** - What to explore next
- **key_moments** - Timestamps of important moments worth rewatching

**Invent your own sections!** If this is a cooking video, maybe you need "ingredients" and "technique_tips". If it's a debate, maybe "argument_structure" and "logical_fallacies". If it's a tutorial, maybe "step_by_step" and "common_mistakes". Match the content.

This being said, ALWAYS include a detailed summary of the video as one of the first section.

## Schema Rules

- Use snake_case for section keys (e.g., "key_takeaways", "action_items")
- Only include sections that are genuinely valuable for THIS content
- Quality over quantity - 5 great sections beats 15 mediocre ones
- The description field should be clear instructions for extraction
- Type can be "string" (for prose/markdown), "string[]" (for lists), or "object" (for key-value pairs)
- In string values, you can use markdown extensively

## Analysis Rules

- Every key in your analysis MUST match a key in your schema
- Be thorough but concise - no fluff
- For mermaid diagrams, use proper syntax in a fenced code block
- For string[] types, provide an array of strings
- For object types, provide a structured object
- Preserve the voice/personality of the speaker where it adds value
- Include timestamps (MM:SS or HH:MM:SS) where relevant
`.trim();

/**
 * Build the user message for the god prompt
 */
export function buildGodPromptUserMessage(input: {
  title: string;
  channelName?: string;
  description?: string;
  transcript: string;
  additionalInstructions?: string;
}): string {
  const parts: string[] = [];

  parts.push(`# Video: ${input.title}`);

  if (input.channelName) {
    parts.push(`**Channel**: ${input.channelName}`);
  }

  if (input.description) {
    parts.push(`## Description\n${input.description}`);
  }

  parts.push(`## Transcript\n\`\`\`\n${input.transcript}\n\`\`\``);

  if (input.additionalInstructions) {
    parts.push(
      `## Additional Instructions from User\n${input.additionalInstructions}`,
    );
  }

  parts.push(
    `\nAnalyze this transcript. Think about what would be genuinely USEFUL to extract, design a custom schema for this specific content, and perform the extraction.`,
  );

  return parts.join("\n\n");
}

/**
 * System prompt for derived analysis (running schema separately)
 */
export const DERIVED_ANALYSIS_SYSTEM_PROMPT = `
You are an expert at extracting structured information from video transcripts.

You will be given:
1. A video transcript
2. An extraction schema with section definitions

Your task: Extract the content according to the schema. Follow each section's description precisely.

## Rules

- Every key in your output MUST match a key in the provided schema
- Follow the type specification: "string" for prose, "string[]" for arrays, "object" for structured data
- Be thorough but concise
- For mermaid diagrams, use proper syntax in a fenced code block
- Include timestamps where relevant
`.trim();

/**
 * Build user message for derived analysis
 */
export function buildDerivedAnalysisUserMessage(input: {
  title: string;
  transcript: string;
  schema: GeneratedSchema;
}): string {
  const parts: string[] = [];

  parts.push(`# Video: ${input.title}`);

  parts.push(
    `## Extraction Schema\n\`\`\`json\n${JSON.stringify(input.schema, null, 2)}\n\`\`\``,
  );

  parts.push(`## Transcript\n\`\`\`\n${input.transcript}\n\`\`\``);

  parts.push(`\nExtract the content according to the schema above.`);

  return parts.join("\n\n");
}
