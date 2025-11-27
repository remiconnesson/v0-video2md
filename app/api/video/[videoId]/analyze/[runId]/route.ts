import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { videoAnalysisRuns } from "@/db/schema";

// ============================================================================
// GET - Get a specific analysis run
// ============================================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { videoId, runId } = await params;
  const runIdNum = parseInt(runId, 10);

  if (Number.isNaN(runIdNum)) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }

  const [run] = await db
    .select()
    .from(videoAnalysisRuns)
    .where(eq(videoAnalysisRuns.id, runIdNum))
    .limit(1);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Verify the run belongs to the video
  if (run.videoId !== videoId) {
    return NextResponse.json(
      { error: "Run does not belong to this video" },
      { status: 403 },
    );
  }

  return NextResponse.json(run);
}
