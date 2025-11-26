/**
 * Server-side utility for YouTube URL handling and video ID extraction
 */

/**
 * Checks if an IP address is in a private or reserved range
 * This prevents SSRF attacks targeting internal services
 */
function isPrivateOrReservedIP(hostname: string): boolean {
  // Check for localhost
  if (hostname === "localhost" || hostname === "::1") {
    return true;
  }

  // IPv4 patterns
  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);

    // Check if all octets are valid (0-255)
    if (octets.some((octet) => octet > 255)) {
      return true; // Invalid IP, treat as dangerous
    }

    const [a, b] = octets;

    // Private ranges
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16

    // Loopback
    if (a === 127) return true; // 127.0.0.0/8

    // Link-local
    if (a === 169 && b === 254) return true; // 169.254.0.0/16

    // Multicast and reserved
    if (a >= 224) return true; // 224.0.0.0/4 and above

    // This host (0.0.0.0/8)
    if (a === 0) return true;
  }

  // IPv6 patterns - check for loopback and link-local
  if (hostname.includes(":")) {
    const lower = hostname.toLowerCase();
    // Loopback
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    // Link-local (fe80::/10)
    if (lower.startsWith("fe80:")) return true;
    // Unique local addresses (fc00::/7)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // IPv4-mapped IPv6 addresses
    if (lower.includes("::ffff:")) return true;
  }

  return false;
}

/**
 * Allowed YouTube domains for URL resolution
 */
const ALLOWED_YOUTUBE_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
];

/**
 * Validates a URL to prevent SSRF attacks
 * Only allows HTTP/HTTPS protocols and YouTube domains
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

  // Only allow http and https protocols
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      valid: false,
      error: "Only HTTP and HTTPS protocols are allowed",
    };
  }

  // Check if hostname is a YouTube domain
  const hostname = url.hostname.toLowerCase();
  const isYouTubeDomain = ALLOWED_YOUTUBE_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  if (!isYouTubeDomain) {
    return {
      valid: false,
      error: "Only YouTube URLs are allowed for resolution",
    };
  }

  // Check for private/reserved IPs
  if (isPrivateOrReservedIP(hostname)) {
    return {
      valid: false,
      error: "Access to private or reserved IP addresses is not allowed",
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
 * Includes SSRF protection by validating URLs before fetching
 */
export async function resolveShortUrl(url: string): Promise<string | null> {
  try {
    // First try to extract ID directly
    const directId = extractYoutubeVideoId(url);
    if (directId) {
      return directId;
    }

    // Validate the URL to prevent SSRF attacks
    const validation = validateUrlForSSRF(url);
    if (!validation.valid) {
      console.error(`URL validation failed: ${validation.error}`);
      return null;
    }

    // If it's a short URL that we couldn't parse, try to resolve it
    if (url.includes("youtu.be") || url.length < 30) {
      // Use manual redirect to validate each redirect URL
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
      });

      // If there's a redirect, validate the redirect URL
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.has("location")
      ) {
        const redirectUrl = response.headers.get("location");
        if (!redirectUrl) {
          return null;
        }

        // Resolve relative URLs
        const absoluteRedirectUrl = new URL(redirectUrl, url).toString();

        // Validate the redirect URL
        const redirectValidation = validateUrlForSSRF(absoluteRedirectUrl);
        if (!redirectValidation.valid) {
          console.error(
            `Redirect URL validation failed: ${redirectValidation.error}`,
          );
          return null;
        }

        return extractYoutubeVideoId(absoluteRedirectUrl);
      }

      // No redirect, try to extract from the original URL
      return extractYoutubeVideoId(url);
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
 * Fetches video title from YouTube oEmbed API
 * Returns null if fetching fails (graceful degradation)
 */
export async function fetchYoutubeVideoTitle(
  videoId: string,
): Promise<string | null> {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return null;
  }

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.title || null;
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
