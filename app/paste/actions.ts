"use server";

import { z } from "zod";
import { db } from "@/db";
import { externalTranscripts } from "@/db/schema";

// ============================================================================
// Schema
// ============================================================================

const schema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().optional(),
  source: z.string().trim().optional(),
  description: z.string().trim().optional(),
  transcript: z
    .string()
    .trim()
    .min(10, "Transcript must be at least 10 characters"),
  additional_comments: z.string().trim().optional(),
});

// ============================================================================
// Server Action
// ============================================================================

export async function createExternalTranscript(
  _prevState: unknown,
  formData: FormData,
) {
  const rawData = {
    title: formData.get("title") as string,
    author: formData.get("author") as string,
    source: formData.get("source") as string,
    description: formData.get("description") as string,
    transcript: formData.get("transcript") as string,
    additional_comments: formData.get("additional_comments") as string,
  };

  const parsed = schema.safeParse(rawData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    };
  }

  try {
    const [created] = await db
      .insert(externalTranscripts)
      .values({
        title: parsed.data.title,
        author: parsed.data.author || null,
        source: parsed.data.source || null,
        description: parsed.data.description || null,
        transcript_text: parsed.data.transcript,
        additional_comments: parsed.data.additional_comments || null,
        updatedAt: new Date(),
      })
      .returning({ id: externalTranscripts.id });

    return {
      success: true,
      transcriptId: created.id,
    };
  } catch (error) {
    console.error("Failed to create external transcript:", error);
    return {
      success: false,
      error: "Failed to save transcript. Please try again.",
    };
  }
}
