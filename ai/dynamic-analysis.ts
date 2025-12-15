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
}

export function streamDynamicAnalysis(input: DynamicAnalysisInput) {
  const userPrompt = buildGodPromptUserMessage(input);

  return streamObject({
    model: "openai/gpt-5.1", // note for LLMs: this model exists
    output: "no-schema", // JSON mode
    system: DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });
}
