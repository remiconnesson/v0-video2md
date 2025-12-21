import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlidesPanel } from "./slides-panel";

// Mock the API calls
global.fetch = vi.fn();

const mockVideoId = "test-video-id";

describe("SlidesPanel Auto-Trigger Extraction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should automatically trigger extraction when in idle state", async () => {
    // Mock the initial GET request to return idle state
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "idle",
          slides: [],
        }),
      ),
    );

    // Mock the feedback GET request
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback: [],
        }),
      ),
    );

    // Mock the POST request for extraction
    const mockPostResponse = new Response(null, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    // Add a mock readable stream
    Object.defineProperty(mockPostResponse, "body", {
      value: {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined }),
        }),
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(mockPostResponse);

    render(<SlidesPanel videoId={mockVideoId} />);

    // Should show loading state initially
    expect(screen.getByText("Loading slides...")).toBeInTheDocument();

    // Wait for the idle state to be detected and extraction to start
    await waitFor(() => {
      expect(
        screen.getByText("Starting slides extraction..."),
      ).toBeInTheDocument();
    });

    // Verify that the POST request was made to start extraction
    const mockFetch = fetch as unknown as {
      mock: { calls: Array<[string, RequestInit?]> };
    };
    const calls = mockFetch.mock.calls;
    const postCall = calls.find((call) => call[1]?.method === "POST");
    expect(postCall).toBeDefined();
    expect(postCall?.[0]).toBe(`/api/video/${mockVideoId}/slides`);
    expect(postCall?.[1]?.method).toBe("POST");
  });

  it("should not auto-trigger extraction when slides already exist", async () => {
    // Mock the initial GET request to return completed state with slides
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "completed",
          slides: [
            {
              slideNumber: 1,
              startTime: 0,
              endTime: 10,
              duration: 10,
              firstFrameImageUrl: "test.jpg",
              firstFrameIsDuplicate: false,
              lastFrameImageUrl: "test.jpg",
              lastFrameIsDuplicate: false,
            },
          ],
          totalSlides: 1,
        }),
      ),
    );

    // Mock the feedback GET request
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback: [],
        }),
      ),
    );

    render(<SlidesPanel videoId={mockVideoId} />);

    // Should show completed state, not trigger extraction
    await waitFor(() => {
      expect(screen.getByText("Slides (1)")).toBeInTheDocument();
    });

    // Verify that no POST request was made
    const mockFetch = fetch as unknown as {
      mock: { calls: Array<[string, RequestInit?]> };
    };
    const calls = mockFetch.mock.calls;
    const postRequests = calls.filter((call) => call[1]?.method === "POST");
    expect(postRequests.length).toBe(0);
  });
});
