import { desc, eq } from "drizzle-orm";
import { streamDynamicAnalysis } from "@/ai/dynamic-analysis";
import { db } from "@/db";
import {
  externalTranscriptAnalysisRuns,
  externalTranscripts,
} from "@/db/schema";

// ============================================================================
// Transcript Data Interface
// ============================================================================

export interface ExternalTranscriptData {
  transcriptId: string;
  title: string;
  author: string | null;
  description: string | null;
  source: string | null;
  additionalComments: string | null;
  transcript: string; // Plain text
}

// ============================================================================
// Step: Fetch external transcript data from DB
// ============================================================================

export async function fetchExternalTranscriptData(
  transcriptId: string,
): Promise<ExternalTranscriptData | null> {
  "use step";

  const dbQueryResult = await db
    .select({
      id: externalTranscripts.id,
      title: externalTranscripts.title,
      author: externalTranscripts.author,
      description: externalTranscripts.description,
      source: externalTranscripts.source,
      additionalComments: externalTranscripts.additional_comments,
      transcriptText: externalTranscripts.transcript_text,
    })
    .from(externalTranscripts)
    .where(eq(externalTranscripts.id, transcriptId))
    .limit(1);

  const transcriptRow = dbQueryResult[0];
  if (!transcriptRow || !transcriptRow.transcriptText) {
    return null;
  }

  return {
    transcriptId: transcriptRow.id,
    title: transcriptRow.title,
    author: transcriptRow.author,
    description: transcriptRow.description,
    source: transcriptRow.source,
    additionalComments: transcriptRow.additionalComments,
    transcript: transcriptRow.transcriptText, // Already plain text, no formatting needed
  };
}

// ============================================================================
// Step: Get next version number for a transcript
// ============================================================================

export async function getNextVersion(transcriptId: string): Promise<number> {
  "use step";

  const versionQueryResult = await db
    .select({ version: externalTranscriptAnalysisRuns.version })
    .from(externalTranscriptAnalysisRuns)
    .where(eq(externalTranscriptAnalysisRuns.transcriptId, transcriptId))
    .orderBy(desc(externalTranscriptAnalysisRuns.version))
    .limit(1);

  const maxVersion = versionQueryResult[0]?.version ?? 0;
  return maxVersion + 1;
}

// ============================================================================
// Step: Create analysis run (atomic version calculation + insert)
// ============================================================================

export async function createExternalTranscriptAnalysisRun(
  transcriptId: string,
  additionalInstructions?: string,
): Promise<number> {
  "use step";

  // Get next version
  const versionQueryResult = await db
    .select({ version: externalTranscriptAnalysisRuns.version })
    .from(externalTranscriptAnalysisRuns)
    .where(eq(externalTranscriptAnalysisRuns.transcriptId, transcriptId))
    .orderBy(desc(externalTranscriptAnalysisRuns.version))
    .limit(1);

  const nextVersion = (versionQueryResult[0]?.version ?? 0) + 1;

  // Insert the run with conflict resolution for idempotency during workflow replay
  const [createdRun] = await db
    .insert(externalTranscriptAnalysisRuns)
    .values({
      transcriptId,
      version: nextVersion,
      additionalInstructions: additionalInstructions ?? null,
      status: "streaming",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        externalTranscriptAnalysisRuns.transcriptId,
        externalTranscriptAnalysisRuns.version,
      ],
      set: {
        additionalInstructions: additionalInstructions ?? null,
        status: "streaming",
        updatedAt: new Date(),
      },
    })
    .returning({ id: externalTranscriptAnalysisRuns.id });

  return createdRun.id;
}

// ============================================================================
// Step: Run god prompt for external transcript
// ============================================================================

export async function runExternalTranscriptGodPrompt(
  transcriptData: ExternalTranscriptData,
  additionalInstructions?: string,
): Promise<Record<string, unknown>> {
  "use step";

  const analysisStream = streamDynamicAnalysis({
    title: transcriptData.title,
    channelName: transcriptData.author ?? undefined,
    description: transcriptData.description ?? undefined,
    transcript: transcriptData.transcript, // Plain text, no timestamps
    additionalInstructions,
  });

  for await (const partialResult of analysisStream.partialObjectStream) {
    // Import emitPartialResult dynamically to avoid circular dependency
    const { emitPartialResult } = await import("./stream-emitters");
    await emitPartialResult(partialResult);
  }

  const finalAnalysisResult = await analysisStream.object;

  // Import emitResult dynamically to avoid circular dependency
  const { emitResult } = await import("./stream-emitters");
  await emitResult(finalAnalysisResult);
  return finalAnalysisResult as Record<string, unknown>;
}

// ============================================================================
// Step: Update run status to completed
// ============================================================================

export async function completeExternalTranscriptRun(
  dbRunId: number,
  result: Record<string, unknown>,
): Promise<void> {
  "use step";

  await db
    .update(externalTranscriptAnalysisRuns)
    .set({
      result,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(externalTranscriptAnalysisRuns.id, dbRunId));
}

// ============================================================================
// Step: Mark run as failed
// ============================================================================

export async function failExternalTranscriptRun(
  dbRunId: number,
): Promise<void> {
  "use step";

  await db
    .update(externalTranscriptAnalysisRuns)
    .set({
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(externalTranscriptAnalysisRuns.id, dbRunId));
}
