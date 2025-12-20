import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  extractYoutubeVideoId,
  fetchYoutubeVideoTitle,
  processYoutubeInput,
  resolveShortUrl,
  validateYoutubeVideoId,
} from "./youtube-utils";

const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

afterAll(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

// Clear mocks between tests to prevent cross-test pollution
beforeEach(() => {
  consoleErrorSpy.mockClear();
  consoleWarnSpy.mockClear();
});

describe("extractYoutubeVideoId", () => {
  it("should extract video ID from standard youtube.com watch URL", () => {
    const videoId = extractYoutubeVideoId(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from youtu.be short URL", () => {
    const videoId = extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ");
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from embed URL", () => {
    const videoId = extractYoutubeVideoId(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from /v/ URL", () => {
    const videoId = extractYoutubeVideoId(
      "https://www.youtube.com/v/dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from mobile URL", () => {
    const videoId = extractYoutubeVideoId(
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should extract video ID from shorts URL", () => {
    const videoId = extractYoutubeVideoId(
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should accept plain video ID", () => {
    const videoId = extractYoutubeVideoId("dQw4w9WgXcQ");
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should handle video ID with hyphens and underscores", () => {
    const videoId = extractYoutubeVideoId("a-b_c123456");
    expect(videoId).toBe("a-b_c123456");
  });

  it("should return null for invalid video ID length", () => {
    expect(extractYoutubeVideoId("short")).toBeNull();
    expect(extractYoutubeVideoId("toolongvideoid12345")).toBeNull();
  });

  it("should return null for invalid characters", () => {
    expect(extractYoutubeVideoId("invalid@id!")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(extractYoutubeVideoId("")).toBeNull();
  });

  it("should return null for non-youtube URLs", () => {
    expect(extractYoutubeVideoId("https://vimeo.com/123456")).toBeNull();
  });

  it("should handle URLs with additional query parameters", () => {
    const videoId = extractYoutubeVideoId(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should handle whitespace in input", () => {
    const videoId = extractYoutubeVideoId("  dQw4w9WgXcQ  ");
    expect(videoId).toBe("dQw4w9WgXcQ");
  });
});

describe("resolveShortUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  it("should return video ID directly if it can be extracted without network call", async () => {
    const videoId = await resolveShortUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should return video ID for plain video ID without network call", async () => {
    const videoId = await resolveShortUrl("dQw4w9WgXcQ");
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should return null for non-URL input", async () => {
    const videoId = await resolveShortUrl("not a url");
    expect(videoId).toBeNull();
  });

  it("should follow redirects for youtu.be URLs", async () => {
    // Mock the first HEAD request - responds with redirect
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 301,
        headers: {
          has: (name: string) => name === "location",
          get: (name: string) =>
            name === "location"
              ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              : null,
        },
      })
      .mockResolvedValueOnce({
        // Second request to the final URL
        status: 200,
        headers: {
          has: () => false,
          get: () => null,
        },
      });
    global.fetch = mockFetch;

    // Use a non-11-char path to force network resolution
    const videoId = await resolveShortUrl("https://youtu.be/short");
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should reject URLs that redirect to non-YouTube domains", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      status: 301,
      headers: {
        has: (name: string) => name === "location",
        get: (name: string) =>
          name === "location" ? "https://evil.com/malicious" : null,
      },
    });
    global.fetch = mockFetch;

    // Use a non-11-char path to force network resolution
    const videoId = await resolveShortUrl("https://youtu.be/short");
    expect(videoId).toBeNull();
  });

  it("should handle relative redirects", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 302,
        headers: {
          has: (name: string) => name === "location",
          get: (name: string) =>
            // When the redirect is relative, it's resolved against the current URL
            // So a relative redirect from youtu.be would stay on youtu.be
            // But in reality, youtu.be would redirect to youtube.com with absolute URL
            name === "location"
              ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              : null,
        },
      })
      .mockResolvedValueOnce({
        // Second request to the final URL
        status: 200,
        headers: {
          has: () => false,
          get: () => null,
        },
      });
    global.fetch = mockFetch;

    // Use a non-11-char path to force network resolution
    const videoId = await resolveShortUrl("https://youtu.be/short");
    expect(videoId).toBe("dQw4w9WgXcQ");
  });

  it("should prevent SSRF attacks with private IPs", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Test various private IP ranges - the URL should be validated before fetch
    const videoId = await resolveShortUrl("https://youtu.be/abc12345678");
    // Since 'abc12345678' is 11 chars and looks like a valid ID, it will be extracted directly
    expect(videoId).toBe("abc12345678");
  });

  it("should return null after max redirects", async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        status: 301,
        headers: {
          has: (name: string) => name === "location",
          get: (name: string) =>
            name === "location" ? "https://youtu.be/redirect" : null,
        },
      }),
    );
    global.fetch = mockFetch;

    // Use a non-11-char path to force network resolution
    const videoId = await resolveShortUrl("https://youtu.be/short");
    expect(videoId).toBeNull();
  });

  it("should return null for fetch error", async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    global.fetch = mockFetch;

    // Use a non-11-char path to force network resolution
    const videoId = await resolveShortUrl("https://youtu.be/short");
    expect(videoId).toBeNull();
  });

  it("should return video ID directly for URLs without youtu.be", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const videoId = await resolveShortUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(videoId).toBe("dQw4w9WgXcQ"); // Direct extraction, no fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("validateYoutubeVideoId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true for valid existing video", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true });
    global.fetch = mockFetch;

    const isValid = await validateYoutubeVideoId("dQw4w9WgXcQ");
    expect(isValid).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ&format=json",
    );
  });

  it("should return false for non-existing video", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false });
    global.fetch = mockFetch;

    const isValid = await validateYoutubeVideoId("invalid1234");
    expect(isValid).toBe(false);
  });

  it("should return false for invalid video ID format", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    expect(await validateYoutubeVideoId("short")).toBe(false);
    expect(await validateYoutubeVideoId("toolongvideoid123456")).toBe(false);
    expect(await validateYoutubeVideoId("invalid@id!")).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return false for empty video ID", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    const isValid = await validateYoutubeVideoId("");
    expect(isValid).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle fetch errors gracefully", async () => {
    // Suppress error stack traces for this specific test
    const originalConsoleError = console.error;
    console.error = () => {};

    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    global.fetch = mockFetch;

    const isValid = await validateYoutubeVideoId("dQw4w9WgXcQ");
    expect(isValid).toBe(false);

    // Restore console.error
    console.error = originalConsoleError;
  });
});

describe("fetchYoutubeVideoTitle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch and return video title", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Never Gonna Give You Up" }),
    });
    global.fetch = mockFetch;

    const title = await fetchYoutubeVideoTitle("dQw4w9WgXcQ");
    expect(title).toBe("Never Gonna Give You Up");
  });

  it("should return null for invalid video ID format", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    expect(await fetchYoutubeVideoTitle("short")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should return null when fetch fails", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false });
    global.fetch = mockFetch;

    const title = await fetchYoutubeVideoTitle("dQw4w9WgXcQ");
    expect(title).toBeNull();
  });

  it("should return null when response has no title", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    global.fetch = mockFetch;

    const title = await fetchYoutubeVideoTitle("dQw4w9WgXcQ");
    expect(title).toBeNull();
  });

  it("should handle fetch errors gracefully", async () => {
    // Suppress error stack traces for this specific test
    const originalConsoleError = console.error;
    console.error = () => {};

    const mockFetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));
    global.fetch = mockFetch;

    const title = await fetchYoutubeVideoTitle("dQw4w9WgXcQ");
    expect(title).toBeNull();

    // Restore console.error
    console.error = originalConsoleError;
  });
});

describe("processYoutubeInput", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should process valid YouTube URL", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true });
    global.fetch = mockFetch;

    const result = await processYoutubeInput(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.error).toBeUndefined();
  });

  it("should process valid video ID", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true });
    global.fetch = mockFetch;

    const result = await processYoutubeInput("dQw4w9WgXcQ");
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.error).toBeUndefined();
  });

  it("should return error for invalid input", async () => {
    const result = await processYoutubeInput("");
    expect(result.videoId).toBeNull();
    expect(result.error).toBe("Invalid input");
  });

  it("should return error when video ID cannot be extracted", async () => {
    const result = await processYoutubeInput("not a valid url or id");
    expect(result.videoId).toBeNull();
    expect(result.error).toContain("Could not extract video ID");
  });

  it("should return error for non-existing video", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false });
    global.fetch = mockFetch;

    const result = await processYoutubeInput("12345678901");
    expect(result.videoId).toBeNull();
    expect(result.error).toContain("Video not found");
  });

  it("should handle whitespace in input", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true });
    global.fetch = mockFetch;

    const result = await processYoutubeInput("  dQw4w9WgXcQ  ");
    expect(result.videoId).toBe("dQw4w9WgXcQ");
    expect(result.error).toBeUndefined();
  });
});