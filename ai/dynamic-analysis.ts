import { generateObject } from "ai";
import {
  buildGodPromptUserMessage,
  DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
  buildDerivedAnalysisUserMessage,
  DERIVED_ANALYSIS_SYSTEM_PROMPT,
} from "./dynamic-analysis-prompt";
import {
  type GodPromptOutput,
  godPromptOutputSchema,
  derivedAnalysisOutputSchema,
  type DerivedAnalysisOutput,
  type GeneratedSchema,
} from "./dynamic-analysis-schema";

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
  input: DynamicAnalysisInput
): Promise<GodPromptOutput> {
  const userPrompt = buildGodPromptUserMessage(input);

  const result = await generateObject({
    model: "openai/gpt-4o",
    schema: godPromptOutputSchema,
    system: DYNAMIC_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
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
  input: DerivedAnalysisInput
): Promise<DerivedAnalysisOutput> {
  const userPrompt = buildDerivedAnalysisUserMessage(input);

  const result = await generateObject({
    model: "openai/gpt-4o",
    schema: derivedAnalysisOutputSchema,
    system: DERIVED_ANALYSIS_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}

// Re-export types
export type {
  GodPromptOutput,
  DerivedAnalysisOutput,
  GeneratedSchema,
  SectionDefinition,
} from "./dynamic-analysis-schema";
