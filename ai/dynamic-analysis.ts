import { streamObject } from "ai";
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

export function streamDynamicAnalysis(input: DynamicAnalysisInput) {
  const userPrompt = buildGodPromptUserMessage(input);

  return streamObject({
    model: "openai/gpt-5-mini",
    output: "no-schema",
    system: DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });
}
