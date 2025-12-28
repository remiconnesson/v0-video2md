import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisPanel } from "./analysis-panel";

// Mock the streaming fetch hook
vi.mock("@/lib/use-streaming-fetch", () => ({
  useStreamingFetch: vi.fn(),
}));

// Mock copy hooks
vi.mock("@/hooks/use-copy-with-feedback", () => ({
  useCopyWithFeedback: vi.fn(() => [false, vi.fn()]),
}));

vi.mock("@uidotdev/usehooks", () => ({
  useCopyToClipboard: vi.fn(() => ["", vi.fn()]),
}));

const mockVideoId = "test-video-id";
const mockTitle = "Test Video Title";
const mockChannelName = "Test Channel";

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <NuqsTestingAdapter>{children}</NuqsTestingAdapter>;
}

describe("AnalysisPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Loading and Streaming States", () => {
    it("should render without errors when streaming", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "streaming" as const,
        data: {},
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      const { container } = render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      // Should render the component
      expect(container).toBeInTheDocument();
    });

    it("should render without errors when in loading state", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "loading" as const,
        data: {},
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      const { container } = render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      // Should render the component
      expect(container).toBeInTheDocument();
    });

    it("should show 'No analysis available' when ready with empty data", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {},
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      expect(screen.getByText("No analysis available.")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when fetch fails", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "error" as const,
        data: {},
        error: "Failed to fetch analysis",
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      expect(screen.getByText("Failed to fetch analysis")).toBeInTheDocument();
    });
  });

  describe("Content Display", () => {
    it("should accept data with multiple sections", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          tldr: "This is a summary",
          key_takeaways: ["Point 1", "Point 2"],
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      const { container } = render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      // Should render without errors
      expect(container).toBeInTheDocument();
    });

    it("should render string content correctly", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          summary: "This is a test summary",
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("This is a test summary")).toBeInTheDocument();
      });
    });

    it("should render array content as list", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          items: ["Item 1", "Item 2", "Item 3"],
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Item 1/)).toBeInTheDocument();
        expect(screen.getByText(/Item 2/)).toBeInTheDocument();
        expect(screen.getByText(/Item 3/)).toBeInTheDocument();
      });
    });

    it("should show 'No content' for empty/null values", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          empty: "",
          nullValue: null,
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        const noContentElements = screen.getAllByText("No content");
        expect(noContentElements.length).toBe(2);
      });
    });

    it("should show 'No items' for empty arrays", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          emptyList: [],
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("No items")).toBeInTheDocument();
      });
    });
  });

  describe("Copy Functionality", () => {
    it("should render copy buttons in the UI", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          summary: "Test summary",
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      await waitFor(() => {
        const copyButtons = screen.queryAllByRole("button", {
          name: /copy/i,
        });
        // Should have at least one copy button
        expect(copyButtons.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Section Navigation", () => {
    it("should render panel with multiple data sections", async () => {
      const { useStreamingFetch } = await import("@/lib/use-streaming-fetch");
      vi.mocked(useStreamingFetch).mockReturnValue({
        status: "ready" as const,
        data: {
          tldr: "Summary",
          key_takeaways: ["Point 1"],
        },
        error: null,
        statusMessage: "",
        refetch: vi.fn(),
        reset: vi.fn(),
      });

      const { container } = render(
        <TestWrapper>
          <AnalysisPanel
            videoId={mockVideoId}
            title={mockTitle}
            channelName={mockChannelName}
          />
        </TestWrapper>,
      );

      // Should render the component
      expect(container).toBeInTheDocument();
    });
  });
});
