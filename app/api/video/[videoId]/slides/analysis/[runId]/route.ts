import { getRun } from "workflow/api";
import { createSSEResponse, errorResponse, logError } from "@/lib/api-utils";

/**
 * GET /api/video/[videoId]/slides/analysis/[runId]
 *
 * Resume or subscribe to a slide analysis workflow stream.
 *
 * Query params:
 * - startIndex: Optional. Resume from a specific stream index.
 * - namespace: Optional. Subscribe to a specific slide's namespaced stream.
 *   Format: "{slideNumber}-{first|last}" (e.g., "1-first", "3-last")
 *
 * Without namespace: Returns the main workflow stream (SlideAnalysisStreamEvent)
 * With namespace: Returns the specific slide's stream (SlideTextStreamState)
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides/analysis/[runId]">,
) {
  const { runId } = await ctx.params;
  const url = new URL(request.url);
  const startIndex = url.searchParams.get("startIndex");
  const namespace = url.searchParams.get("namespace");

  try {
    const run = getRun(runId);
    const stream = run.getReadable({
      startIndex: startIndex ? Number.parseInt(startIndex, 10) : undefined,
      namespace: namespace ?? undefined,
    });

    return createSSEResponse(stream);
  } catch (error) {
    logError(error, "Failed to resume slide analysis stream", {
      runId,
      namespace,
    });
    return errorResponse("Failed to resume stream", 500);
  }
}
