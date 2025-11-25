/**
 * Server-side utility for YouTube URL handling and video ID extraction
 */

/**
 * Extracts YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - Plain video IDs (11 characters)
 */
export function extractYoutubeVideoId(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmedInput = input.trim();

  // Check if it's already a valid video ID (11 characters, alphanumeric, dash, underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedInput)) {
    return trimmedInput;
  }

  // Patterns for various YouTube URL formats
  const patterns = [
    // Standard watch URL with query parameters
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL (youtu.be)
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URL
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // Video URL
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // Mobile URL
    /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    // Shorts URL
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmedInput.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Resolves a short URL to get the full URL and extract the video ID
 * Handles youtu.be redirects and other shortened URLs
 */
export async function resolveShortUrl(url: string): Promise<string | null> {
  try {
    // First try to extract ID directly
    const directId = extractYoutubeVideoId(url);
    if (directId) {
      return directId;
    }

    // If it's a short URL that we couldn't parse, try to resolve it
    if (url.includes("youtu.be") || url.length < 30) {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
      });

      const finalUrl = response.url;
      return extractYoutubeVideoId(finalUrl);
    }

    return null;
  } catch (error) {
    console.error("Error resolving short URL:", error);
    return null;
  }
}

/**
 * Validates if a YouTube video ID is valid by checking if the video exists
 */
export async function validateYoutubeVideoId(
  videoId: string,
): Promise<boolean> {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return false;
  }

  try {
    // Check if video exists using oembed endpoint (no API key required)
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );

    return response.ok;
  } catch (error) {
    console.error("Error validating YouTube video ID:", error);
    return false;
  }
}

/**
 * Complete URL processing: extract ID, resolve if needed, and validate
 */
export async function processYoutubeInput(
  input: string,
): Promise<{ videoId: string | null; error?: string }> {
  if (!input || typeof input !== "string") {
    return { videoId: null, error: "Invalid input" };
  }

  const trimmedInput = input.trim();

  // Try direct extraction first
  let videoId = extractYoutubeVideoId(trimmedInput);

  // If we couldn't extract directly and it looks like a URL, try resolving
  if (
    !videoId &&
    (trimmedInput.startsWith("http") || trimmedInput.includes("youtu"))
  ) {
    videoId = await resolveShortUrl(trimmedInput);
  }

  if (!videoId) {
    return {
      videoId: null,
      error:
        "Could not extract video ID from input. Please provide a valid YouTube URL or video ID.",
    };
  }

  // Validate the video ID
  const isValid = await validateYoutubeVideoId(videoId);

  if (!isValid) {
    return {
      videoId: null,
      error: "Video not found. Please check the URL or video ID and try again.",
    };
  }

  return { videoId };
}
