import { streamObject } from "ai";
import { z } from "zod";
import {
  buildGodPromptUserMessage,
  DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
} from "./dynamic-analysis-prompt";

export interface DynamicAnalysisInput {
  title: string;
  channelName?: string;
  description?: string;
  transcript: string;
  additionalInstructions?: string;
}

// Flexible schema that allows any JSON object structure since the analysis output is dynamic
const dynamicAnalysisSchema = z.object({}).passthrough();

export function streamDynamicAnalysis(input: DynamicAnalysisInput) {
  const userPrompt = buildGodPromptUserMessage(input);

  return streamObject({
    model: "openai/gpt-5.1",
    schema: dynamicAnalysisSchema,
    system: DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });
}
