"use server";

import { z } from "zod";
import { extractYoutubeVideoId } from "@/lib/youtube-utils";

const videoIdSchema = z.object({
  videoId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_-]{11}$/, "Invalid YouTube Video ID"),
});

export async function validateVideoId(_prevState: unknown, formData: FormData) {
  const input = (formData.get("videoId") as string | null) || "";

  // Extract video ID from URL if a full URL was provided
  const videoId = extractYoutubeVideoId(input) || input;

  const parsed = videoIdSchema.safeParse({ videoId });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid YouTube Video ID",
    };
  }

  return {
    success: true,
    videoId: parsed.data.videoId,
  };
}

type GetAnalysisVersionsResult =
  | {
      success: true;
      versions: { version: string }[];
    }
  | {
      success: false;
      error: string;
    };

export async function getAnalysisVersions(
  videoId: string,
): Promise<GetAnalysisVersionsResult> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/video/${videoId}/analysis/versions`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      return {
        success: false,
        error: "Failed to fetch analysis versions",
      };
    }

    const data = await response.json();
    return data as GetAnalysisVersionsResult;
  } catch (error) {
    console.error("Error fetching analysis versions:", error);
    return {
      success: false,
      error: "Failed to fetch analysis versions",
    };
  }
}
