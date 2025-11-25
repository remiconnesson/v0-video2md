import { NextResponse } from "next/server";

// Mock video data
const mockVideos: Record<
  string,
  { youtube_id: string; title: string; description: string; transcript: string }
> = {
  CpcS3CQ8NTY: {
    youtube_id: "CpcS3CQ8NTY",
    title: "Understanding Modern Web Development",
    description:
      "A comprehensive guide to modern web development practices and tools.",
    transcript: "Welcome to this video about modern web development...",
  },
  dQw4w9WgXcQ: {
    youtube_id: "dQw4w9WgXcQ",
    title: "Sample Video Title",
    description: "This is a sample video description.",
    transcript: "This is a sample transcript for the video...",
  },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;

  // Return mock video data
  const video = mockVideos[videoId] || {
    youtube_id: videoId,
    title: `Video ${videoId}`,
    description: "No description available",
    transcript: "No transcript available",
  };

  return NextResponse.json({ video });
}
