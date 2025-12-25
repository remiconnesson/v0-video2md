import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlidesPanel } from "./slides-panel";

// Mock the API calls
global.fetch = vi.fn();

const mockVideoId = "test-video-id";

// Create a test wrapper with QueryClientProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

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

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    // Should show loading state initially
    expect(screen.getByText("Loading slides...")).toBeInTheDocument();

    // Wait for the idle state to be detected and extraction to start
    await waitFor(() => {
      expect(
        screen.getByText("Starting slides extraction..."),
      ).toBeInTheDocument();
    });

    // Verify that the POST request was made to start extraction
    await waitFor(() => {
      const mockFetch = fetch as unknown as {
        mock: { calls: Array<[string, RequestInit?]> };
      };
      const calls = mockFetch.mock.calls;
      const postCall = calls.find((call) => call[1]?.method === "POST");
      expect(postCall).toBeDefined();
      expect(postCall?.[0]).toBe(`/api/video/${mockVideoId}/slides`);
      expect(postCall?.[1]?.method).toBe("POST");
    });
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

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    // Should show completed state, not trigger extraction
    await waitFor(() => {
      expect(screen.getByText("Frames (0/2)")).toBeInTheDocument();
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

describe("SlidesPanel Error Handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should display error state when slides query fails", async () => {
    // Mock fetch to reject
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument();
    });
  });

  it("should display error when API returns failed status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "failed",
          errorMessage: "Extraction failed",
          slides: [],
        }),
      ),
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ feedback: [] })),
    );

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("Extraction failed")).toBeInTheDocument();
    });
  });
});

describe("SlidesPanel Completed State", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockCompletedSlides = [
    {
      slideNumber: 1,
      startTime: 0,
      endTime: 10,
      duration: 10,
      firstFrameImageUrl: "test1-first.jpg",
      firstFrameIsDuplicate: false,
      lastFrameImageUrl: "test1-last.jpg",
      lastFrameIsDuplicate: false,
    },
    {
      slideNumber: 2,
      startTime: 10,
      endTime: 20,
      duration: 10,
      firstFrameImageUrl: "test2-first.jpg",
      firstFrameIsDuplicate: false,
      lastFrameImageUrl: "test2-last.jpg",
      lastFrameIsDuplicate: false,
    },
  ];

  it("should show correct frame count", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "completed",
          slides: mockCompletedSlides,
          totalSlides: 2,
        }),
      ),
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ feedback: [] })),
    );

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    await waitFor(() => {
      // 2 slides × 2 frames each = 4 total frames, 0 picked
      expect(screen.getByText("Frames (0/4)")).toBeInTheDocument();
    });
  });

  it("should display tutorial by default", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "completed",
          slides: mockCompletedSlides,
          totalSlides: 2,
        }),
      ),
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ feedback: [] })),
    );

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText("How this page works")).toBeInTheDocument();
    });
  });

  it("should disable 'Show picked only' button when no frames are picked", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "completed",
          slides: mockCompletedSlides,
          totalSlides: 2,
        }),
      ),
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ feedback: [] })),
    );

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    await waitFor(() => {
      const showPickedButton = screen.getByRole("button", {
        name: /show picked only/i,
      });
      expect(showPickedButton).toBeDisabled();
    });
  });

  it("should disable analyze button when slides not confirmed", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "completed",
          slides: mockCompletedSlides,
          totalSlides: 2,
        }),
      ),
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          feedback: [
            {
              slideNumber: 1,
              isFirstFramePicked: true,
              isLastFramePicked: false,
              firstFrameHasUsefulContent: null,
              lastFrameHasUsefulContent: null,
              framesSameness: null,
            },
          ],
        }),
      ),
    );

    render(
      <TestWrapper>
        <NuqsTestingAdapter>
          <SlidesPanel videoId={mockVideoId} />
        </NuqsTestingAdapter>
      </TestWrapper>,
    );

    await waitFor(() => {
      const analyzeButton = screen.getByRole("button", {
        name: /analyze selected slides/i,
      });
      expect(analyzeButton).toBeDisabled();
    });
  });
});
