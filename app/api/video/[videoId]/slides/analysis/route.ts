import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getSlideAnalysisResults } from "@/db/queries";
import {
  createSSEResponse,
  errorResponse,
  logError,
  validateYouTubeVideoId,
} from "@/lib/api-utils";
import { analyzeSelectedSlidesWorkflow } from "@/workflows/analyze-slides";

// ============================================================================
// GET - Get existing slide analysis results
// ============================================================================

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides/analysis">,
) {
  const { videoId } = await ctx.params;

  // Validate videoId format
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

  try {
    const results = await getSlideAnalysisResults(videoId);

    return NextResponse.json({
      success: true,
      results: results.map((r) => ({
        slideNumber: r.slideNumber,
        framePosition: r.framePosition,
        markdown: r.markdownContent,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    logError(error, "Failed to get slide analysis results", { videoId });
    return errorResponse("Failed to get slide analysis results", 500);
  }
}

// ============================================================================
// POST - Start slide analysis workflow
// ============================================================================

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides/analysis">,
) {
  const { videoId } = await ctx.params;

  // Validate videoId format
  const validationError = validateYouTubeVideoId(videoId);
  if (validationError) return validationError;

  try {
    // Start the analysis workflow
    const run = await start(analyzeSelectedSlidesWorkflow, [videoId]);

    return createSSEResponse(run.readable, run.runId);
  } catch (error) {
    logError(error, "Failed to start slide analysis workflow", { videoId });
    return errorResponse("Failed to start slide analysis", 500);
  }
}
