import { NextResponse } from "next/server";
import { z } from "zod";

const slideFeedbackSchema = z.object({
  slide_index: z.number().int().nonnegative(),
  frame_id: z.string().min(1),
  feedback_type: z.enum(["duplicate", "not_relevant"]),
  chapter_index: z.number().int().nonnegative().optional(),
  timestamp: z.number().nonnegative().optional(),
});

type SlideFeedback = z.infer<typeof slideFeedbackSchema>;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const json = await request.json();
  const parsed = slideFeedbackSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const body: SlideFeedback = parsed.data;

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
