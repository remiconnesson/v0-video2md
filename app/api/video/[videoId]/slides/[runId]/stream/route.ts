import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string; runId: string }> },
) {
  const { runId } = await params;
  const url = new URL(request.url);
  const startIndexParam = url.searchParams.get("startIndex");
  const parsedStartIndex =
    startIndexParam !== null ? Number.parseInt(startIndexParam, 10) : undefined;
  const startIndex =
    parsedStartIndex !== undefined &&
    Number.isInteger(parsedStartIndex) &&
    parsedStartIndex >= 0
      ? parsedStartIndex
      : undefined;

  try {
    const run = getRun(runId);
    const stream = run.getReadable({ startIndex });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Failed to resume stream:", error);
    return NextResponse.json(
      { error: "Failed to resume stream" },
      { status: 500 },
    );
  }
}
