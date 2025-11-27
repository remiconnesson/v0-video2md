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

export interface DerivedAnalysisInput {
  title: string;
  transcript: string;
  schema: import("./dynamic-analysis-prompt").GeneratedSchema;
}

/**
 * Generate derived analysis by running a schema against a transcript
 */
export async function generateDerivedAnalysis(
  input: DerivedAnalysisInput,
): Promise<{ sections: import("./dynamic-analysis-prompt").AnalysisValue[] }> {
  const { buildDerivedAnalysisUserMessage, DERIVED_ANALYSIS_SYSTEM_PROMPT } =
    await import("./dynamic-analysis-prompt");
  const { generateObject } = await import("ai");

  const userPrompt = buildDerivedAnalysisUserMessage({
    title: input.title,
    transcript: input.transcript,
  });

  // Build dynamic schema based on the generated schema sections
  const schemaDescription = input.schema.sections
    .map((s) => `- "${s.key}": ${s.description} (type: ${s.type})`)
    .join("\n");

  const result = await generateObject({
    model: "openai/gpt-5-mini",
    output: "no-schema",
    system: `${DERIVED_ANALYSIS_SYSTEM_PROMPT}\n\n## Schema to follow:\n${schemaDescription}`,
    prompt: userPrompt,
  });

  // Transform the result into AnalysisValue[] format
  const sections: import("./dynamic-analysis-prompt").AnalysisValue[] = [];
  const resultObj = result.object as Record<string, unknown>;

  for (const section of input.schema.sections) {
    const value = resultObj[section.key];
    if (value === undefined) continue;

    if (section.type === "string") {
      sections.push({ key: section.key, kind: "string", value: String(value) });
    } else if (section.type === "string[]") {
      sections.push({
        key: section.key,
        kind: "array",
        value: Array.isArray(value) ? value.map(String) : [],
      });
    } else if (section.type === "object") {
      const objValue = value as Record<string, string> | undefined;
      sections.push({
        key: section.key,
        kind: "object",
        value: objValue
          ? Object.entries(objValue).map(([k, v]) => ({
              key: k,
              value: String(v),
            }))
          : [],
      });
    }
  }

  return { sections };
}
