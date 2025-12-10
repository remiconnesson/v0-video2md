import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { externalTranscripts } from "@/db/schema";

// ============================================================================
// Request Schema
// ============================================================================

const CreateTranscriptSchema = z.object({
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
// POST /api/transcript/create
// ============================================================================

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = CreateTranscriptSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const { title, author, source, description, transcript, additional_comments } =
      parsed.data;

    // Insert into database
    const [created] = await db
      .insert(externalTranscripts)
      .values({
        title,
        author: author || null,
        source: source || null,
        description: description || null,
        transcript_text: transcript,
        additional_comments: additional_comments || null,
        updatedAt: new Date(),
      })
      .returning({
        id: externalTranscripts.id,
        createdAt: externalTranscripts.createdAt,
      });

    return NextResponse.json({
      transcriptId: created.id,
      createdAt: created.createdAt,
    });
  } catch (error) {
    console.error("[API] Failed to create external transcript:", error);
    return NextResponse.json(
      { error: "Failed to create transcript" },
      { status: 500 },
    );
  }
}
