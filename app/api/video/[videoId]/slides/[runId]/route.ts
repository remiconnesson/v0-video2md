import { getRun } from "workflow/api";
import { createSSEResponse } from "@/lib/api-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { runId } = await params;
  const url = new URL(request.url);
  const startIndex = url.searchParams.get("startIndex");

  const run = getRun(runId);
  const stream = run.getReadable({
    startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
  });

  return createSSEResponse(stream);
}
