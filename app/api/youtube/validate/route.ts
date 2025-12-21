import { NextResponse } from "next/server";
import { errorResponse, logError } from "@/lib/api-utils";
import { processYoutubeInput } from "@/lib/youtube-utils";

export async function POST(request: Request) {
  try {
    const { input } = await request.json();

    if (!input) {
      return errorResponse("Input is required", 400);
    }

    const result = await processYoutubeInput(input);

    if (result.error) {
      return errorResponse(result.error, 400);
    }

    return NextResponse.json({
      videoId: result.videoId,
      success: true,
    });
  } catch (error) {
    logError(error, "Error validating YouTube input");
    return errorResponse("Failed to validate input", 500);
  }
}
