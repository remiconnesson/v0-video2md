import { z } from "zod";

/**
 * Schema section definition - describes what to extract
 */
export const sectionDefinitionSchema = z.object({
  description: z
    .string()
    .describe("Clear instructions for what to extract in this section"),
  type: z
    .enum(["string", "string[]", "object"])
    .describe(
      "The data type: string for prose, string[] for lists, object for structured data",
    ),
});

export type SectionDefinition = z.infer<typeof sectionDefinitionSchema>;

/**
 * Generated schema - the extraction blueprint
 */
export const generatedSchemaSchema = z.object({
  sections: z
    .record(z.string(), sectionDefinitionSchema)
    .describe(
      "Map of section_key to section definition. Use snake_case for keys.",
    ),
});

export type GeneratedSchema = z.infer<typeof generatedSchemaSchema>;

/**
 * The god prompt outputs everything at once:
 * 1. Reasoning - why these sections were chosen
 * 2. Schema - the extraction blueprint
 * 3. Analysis - the actual extracted content
 */
export const godPromptOutputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "Your analysis: What makes this transcript unique? What would be genuinely useful to extract? Why did you choose these sections?",
    ),
  schema: generatedSchemaSchema.describe(
    "The extraction schema you designed for this specific content",
  ),
  analysis: z
    .record(z.string(), z.unknown())
    .describe(
      "The actual extracted content, following your schema. Keys must match schema section keys exactly.",
    ),
});

export type GodPromptOutput = z.infer<typeof godPromptOutputSchema>;

/**
 * Derived analysis output - just the analysis part
 * Used when running a schema separately
 */
export const derivedAnalysisOutputSchema = z.object({
  analysis: z
    .record(z.string(), z.unknown())
    .describe("Extracted content following the provided schema"),
});

export type DerivedAnalysisOutput = z.infer<typeof derivedAnalysisOutputSchema>;
