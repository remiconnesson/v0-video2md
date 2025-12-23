import { Brand } from "effect";

/**
 * YouTube video ID format: exactly 11 characters of [a-zA-Z0-9_-]
 */
export const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export type YouTubeVideoId = string & Brand.Brand<"YouTubeVideoId">;
export const YouTubeVideoId = Brand.nominal<YouTubeVideoId>();

/**
 * Validates a YouTube video ID format.
 * @param videoId - The video ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidYouTubeVideoId(
  videoId: string,
): videoId is YouTubeVideoId {
  return YOUTUBE_VIDEO_ID_REGEX.test(videoId);
}

/**
 * Server-side utility for YouTube URL handling and video ID extraction
 */

/**
 * Allowed YouTube domains for URL resolution
 */
const ALLOWED_YOUTUBE_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
] as const;

/**
 * Maximum number of redirects to follow when resolving short URLs
 */
const MAX_REDIRECTS = 5;

/**
 * Validates a URL to prevent SSRF attacks.
 * - Only HTTP/HTTPS
 * - YouTube domains only
 */
function validateUrlForSSRF(urlString: string): {
  valid: boolean;
  error?: string;
} {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow http and https
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      valid: false,
      error: "Only HTTP and HTTPS protocols are allowed",
    };
  }

  // Normalise hostname (strip trailing dot, lower-case)
  const hostname = url.hostname.replace(/\.$/, "").toLowerCase();

  // Allowlist YouTube hostnames
  const isYouTubeDomain = ALLOWED_YOUTUBE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  if (!isYouTubeDomain) {
    return {
      valid: false,
      error: "Only YouTube URLs are allowed for resolution",
    };
  }

  return { valid: true };
}

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
export function extractYoutubeVideoId(input: string): YouTubeVideoId | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmedInput = input.trim();

  // Check if it's already a valid video ID (11 characters, alphanumeric, dash, underscore)
  if (isValidYouTubeVideoId(trimmedInput)) {
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
      return YouTubeVideoId(match[1]);
    }
  }

  return null;
}

/**
 * Resolves a short YouTube URL to a full URL and extracts the video ID.
 * - Handles youtu.be redirects
 * - Includes SSRF protection (allowlist, protocol checks, manual redirects)
 */
export async function resolveShortUrl(
  input: string,
): Promise<YouTubeVideoId | null> {
  // 1. If we can extract an ID directly, don't hit the network at all.
  const directId = extractYoutubeVideoId(input);
  if (directId) {
    return directId;
  }

  // 2. Parse the input as a URL; if it's not even a URL, bail.
  let currentUrl: string;
  try {
    currentUrl = new URL(input).toString();
  } catch {
    return null;
  }

  // Only bother resolving obvious short YouTube URLs (e.g. https://youtu.be/xyz)
  if (!currentUrl.includes("youtu.be")) {
    return null;
  }

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const validation = validateUrlForSSRF(currentUrl);
    if (!validation.valid) {
      console.error(`URL validation failed: ${validation.error}`);
      return null;
    }

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual", // <– we handle redirects ourselves
      });
    } catch (err) {
      console.error("Error while resolving YouTube URL", err);
      return null;
    }

    // 3xx: handle redirect manually and loop
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.has("location")
    ) {
      const redirectLocation = response.headers.get("location");
      if (!redirectLocation) {
        return null;
      }

      // Resolve relative redirect against current URL
      let absoluteRedirectUrl: string;
      try {
        absoluteRedirectUrl = new URL(redirectLocation, currentUrl).toString();
      } catch (err) {
        console.error("Invalid redirect URL:", err);
        return null;
      }

      const redirectValidation = validateUrlForSSRF(absoluteRedirectUrl);
      if (!redirectValidation.valid) {
        console.error(
          `Redirect URL validation failed: ${redirectValidation.error}`,
        );
        return null;
      }

      // Next iteration will issue the HEAD to this URL
      currentUrl = absoluteRedirectUrl;
      continue;
    }

    // Not a redirect: final URL; extract the video ID from it.
    const finalId = extractYoutubeVideoId(currentUrl);
    return finalId ?? null;
  }

  console.error("Too many redirects while resolving YouTube URL");
  return null;
}

/**
 * Validates if a YouTube video ID is valid by checking if the video exists
 */
export async function validateYoutubeVideoId(
  videoId: string,
): Promise<boolean> {
  if (!videoId || !isValidYouTubeVideoId(videoId)) {
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
 * Fetches video title from YouTube oEmbed API
 * Returns null if fetching fails (graceful degradation)
 */
export async function fetchYoutubeVideoTitle(
  videoId: string,
): Promise<string | null> {
  if (!videoId || !isValidYouTubeVideoId(videoId)) {
    return null;
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );

    if (!response.ok) {
      return null;
    }

    const oembedData = await response.json();
    return oembedData.title || null;
  } catch (error) {
    console.error("Error fetching YouTube video title:", error);
    return null;
  }
}

/**
 * Complete URL processing: extract ID, resolve if needed, and validate
 */
export async function processYoutubeInput(
  input: string,
): Promise<{ videoId: YouTubeVideoId | null; error?: string }> {
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
