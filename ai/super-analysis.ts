import { streamText } from "ai";
import type { SuperAnalysisInputData } from "@/lib/super-analysis-types";
import {
  buildSuperAnalysisUserMessage,
  SUPER_ANALYSIS_SYSTEM_PROMPT,
} from "./super-analysis-prompt";

export function streamSuperAnalysis(input: SuperAnalysisInputData) {
  const userPrompt = buildSuperAnalysisUserMessage(input);

  return streamText({
    model: "openai/gpt-5.1", // note for LLMs: this model exists
    system: SUPER_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });
}
