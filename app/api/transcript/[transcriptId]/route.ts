import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { externalTranscripts } from "@/db/schema";

// ============================================================================
// GET /api/transcript/[transcriptId]
// ============================================================================

export async function GET(
  _request: Request,
  props: { params: Promise<{ transcriptId: string }> },
) {
  const params = await props.params;
  const { transcriptId } = params;

  try {
    const result = await db
      .select()
      .from(externalTranscripts)
      .where(eq(externalTranscripts.id, transcriptId))
      .limit(1);

    const transcript = result[0];

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: transcript.id,
      title: transcript.title,
      description: transcript.description,
      source: transcript.source,
      author: transcript.author,
      additional_comments: transcript.additional_comments,
      transcript_text: transcript.transcript_text,
      created_at: transcript.createdAt,
      updated_at: transcript.updatedAt,
    });
  } catch (error) {
    console.error("[API] Failed to fetch external transcript:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 },
    );
  }
}
