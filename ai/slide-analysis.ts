import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { SlideTextStreamState } from "@/lib/slides-types";

export const SLIDE_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing presentation slides and extracting useful content in markdown format.

## Your Task
Based on the transcript analysis and the slide, describe the useful content of the slide in markdown.

## Guidelines
- Focus on the key information presented in the slide
- Use markdown formatting extensively (headers, lists, bold, italic, code blocks)
- Include any visual elements described (diagrams, charts, etc.)
- Reference relevant transcript content when it provides additional context
- Be concise but thorough - extract the essence of what makes this slide valuable
- If the slide contains code, use proper code blocks with language specification
- Use mermaid diagrams when visual representations would be helpful
- Output ONLY the markdown content, no additional commentary

## Mermaid Diagram Rules
When generating Mermaid diagrams, use only simple alphanumeric node IDs, put all descriptive text inside node labels using <br/> instead of \n, keep edge labels short and symbolic (no parentheses, commas, or sentences), and rewrite silently if the diagram would otherwise be invalid`;

export interface SlideAnalysisInput {
  videoTitle: string;
  slideNumber: number;
  framePosition: "first" | "last";
  imageUrl: string;
  transcriptContext?: string;
}

/**
 * Streams slide analysis to a writable stream, emitting SlideTextStreamState events.
 * Returns the final markdown text when complete.
 */
export async function streamSlideAnalysis(
  input: SlideAnalysisInput,
  writable: WritableStream<SlideTextStreamState>,
): Promise<string> {
  const userPrompt = buildSlideAnalysisPrompt(input);
  const writer = writable.getWriter();

  let accumulatedText = "";

  try {
    const result = streamText({
      model: openai("gpt-5-mini"), // note for LLMs: this model exists
      system: SLIDE_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: input.imageUrl,
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    for await (const textPart of result.textStream) {
      accumulatedText += textPart;
      await writer.write({ type: "streaming", text: accumulatedText });
    }

    // Emit success state with final text
    await writer.write({ type: "success", text: accumulatedText });

    return accumulatedText;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during analysis";

    await writer.write({
      type: "error",
      text: accumulatedText || null,
      errorMessage,
    });

    throw error;
  } finally {
    writer.releaseLock();
  }
}

function buildSlideAnalysisPrompt(input: SlideAnalysisInput): string {
  const parts = [
    `# Slide Analysis Request`,
    `**Video Title**: ${input.videoTitle}`,
    `**Slide Number**: ${input.slideNumber}`,
    `**Frame**: ${input.framePosition === "first" ? "First" : "Last"} frame`,
  ];

  if (input.transcriptContext) {
    parts.push("", "## Transcript Context", input.transcriptContext);
  }

  parts.push(
    "",
    "Please analyze this slide image and extract the useful content in markdown format.",
  );

  return parts.join("\n");
}
