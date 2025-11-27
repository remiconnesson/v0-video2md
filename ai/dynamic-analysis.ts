import { generateObject, streamObject } from "ai";
import {
  buildDerivedAnalysisUserMessage,
  buildGodPromptUserMessage,
  DERIVED_ANALYSIS_SYSTEM_PROMPT,
  DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
  derivedAnalysisOutputSchema,
  godPromptOutputSchema,
  type DerivedAnalysisOutput,
  type GeneratedSchema,
  type GodPromptOutput,
} from "./dynamic-analysis-prompt";

export interface DynamicAnalysisInput {
  title: string;
  channelName?: string;
  description?: string;
  transcript: string;
  additionalInstructions?: string;
}

/**
 * Runs the god prompt to generate reasoning + schema + analysis
 */
export async function generateDynamicAnalysis(
  input: DynamicAnalysisInput,
): Promise<GodPromptOutput> {
  const userPrompt = buildGodPromptUserMessage(input);

  const result = await generateObject({
    model: "openai/gpt-5-mini",
    schema: godPromptOutputSchema,
    system: DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}

export function streamDynamicAnalysis(input: DynamicAnalysisInput) {
  const userPrompt = buildGodPromptUserMessage(input);

  return streamObject({
    model: "openai/gpt-5-mini",
    schema: godPromptOutputSchema,
    system: DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });
}

export interface DerivedAnalysisInput {
  title: string;
  transcript: string;
  schema: GeneratedSchema;
}

/**
 * Runs a derived analysis using a pre-defined schema
 */
export async function generateDerivedAnalysis(
  input: DerivedAnalysisInput,
): Promise<DerivedAnalysisOutput> {
  const userPrompt = buildDerivedAnalysisUserMessage(input);

  const result = await generateObject({
    model: "openai/gpt-5-mini",
    schema: derivedAnalysisOutputSchema,
    system: DERIVED_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}

// Re-export types
export type {
  DerivedAnalysisOutput,
  GeneratedSchema,
  GodPromptOutput,
  SectionDefinition,
} from "./dynamic-analysis-prompt";
