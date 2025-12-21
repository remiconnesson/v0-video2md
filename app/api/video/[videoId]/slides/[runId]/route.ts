import { getRun } from "workflow/api";
import { createSSEResponse } from "@/lib/api-utils";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/video/[videoId]/slides/[runId]">,
) {
  const { runId } = await ctx.params;
  const url = new URL(request.url);
  const startIndex = url.searchParams.get("startIndex");

  const run = getRun(runId);
  const stream = run.getReadable({
    startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
  });

  return createSSEResponse(stream);
}
