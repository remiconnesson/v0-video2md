import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

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
- Output ONLY the markdown content, no additional commentary`;

export interface SlideAnalysisInput {
  videoTitle: string;
  slideNumber: number;
  framePosition: "first" | "last";
  imageUrl: string;
  transcriptContext?: string;
}

export async function analyzeSlide(input: SlideAnalysisInput): Promise<string> {
  const userPrompt = buildSlideAnalysisPrompt(input);

  const result = await generateText({
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

  return result.text;
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
