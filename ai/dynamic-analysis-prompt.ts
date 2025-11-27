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

- Use snake_case for section keys
- Only include sections that are genuinely valuable for THIS content
- Quality over quantity - 5 great sections beats 15 mediocre ones
- The description field should be clear instructions for extraction
- Type can be "string", "string[]", or "Record<string, string>", in strings, you can use markdown extensively.

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
  schema: { sections: Record<string, { description: string; type: string }> };
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
