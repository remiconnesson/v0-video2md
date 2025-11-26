import { NextResponse } from "next/server";

interface SlideFeedback {
  slide_index: number;
  frame_id: string;
  feedback_type: "duplicate" | "not_relevant";
  chapter_index?: number;
  timestamp?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const body: SlideFeedback = await request.json();

  if (!body.frame_id || !body.feedback_type) {
    return NextResponse.json(
      { error: "Missing required fields: frame_id, feedback_type" },
      { status: 400 },
    );
  }

  console.log("[Slide Feedback]", {
    videoId,
    ...body,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    message: `Feedback recorded: ${body.feedback_type}`,
  });
}
