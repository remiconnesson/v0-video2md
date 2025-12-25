import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SlideData, SlideFeedbackData } from "@/lib/slides-types";
import { SlideCard } from "./slide-card";

const mockSlide: SlideData = {
  slideNumber: 1,
  startTime: 0,
  endTime: 10,
  duration: 10,
  firstFrameImageUrl: "https://example.com/test-first.jpg",
  firstFrameIsDuplicate: false,
  firstFrameDuplicateOfSlideNumber: null,
  firstFrameDuplicateOfFramePosition: null,
  lastFrameImageUrl: "https://example.com/test-last.jpg",
  lastFrameIsDuplicate: false,
  lastFrameDuplicateOfSlideNumber: null,
  lastFrameDuplicateOfFramePosition: null,
};

describe("SlideCard", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup?.();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should render slide information correctly", () => {
    const onSubmitFeedback = vi.fn();

    render(
      <SlideCard
        slide={mockSlide}
        onSubmitFeedback={onSubmitFeedback}
        showOnlyPickedFrames={false}
      />,
    );

    expect(screen.getByText("Slide #1")).toBeInTheDocument();
    expect(screen.getByText("0:00 - 0:10")).toBeInTheDocument();
  });

  it("should display both frame checkboxes by default", () => {
    const onSubmitFeedback = vi.fn();

    render(
      <SlideCard
        slide={mockSlide}
        onSubmitFeedback={onSubmitFeedback}
        showOnlyPickedFrames={false}
      />,
    );

    expect(screen.getByText("Pick First Frame")).toBeInTheDocument();
    expect(screen.getByText("Pick Last Frame")).toBeInTheDocument();
  });

  describe("Frame Picking", () => {
    it("should call onSubmitFeedback when first frame is picked (debounced)", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const onSubmitFeedback = vi.fn();
      const user = userEvent.setup();

      render(
        <SlideCard
          slide={mockSlide}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={false}
        />,
      );

      const firstFrameCheckbox = screen
        .getByText("Pick First Frame")
        .parentElement?.querySelector('input[type="checkbox"]');
      expect(firstFrameCheckbox).not.toBeNull();

      await user.click(firstFrameCheckbox!);

      // Should not call immediately
      expect(onSubmitFeedback).not.toHaveBeenCalled();

      // Wait for debounce (600ms to be safe)
      await waitFor(
        () => {
          expect(onSubmitFeedback).toHaveBeenCalledWith(
            expect.objectContaining({
              slideNumber: 1,
              isFirstFramePicked: true,
              isLastFramePicked: false,
            }),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should call onSubmitFeedback when last frame is picked (debounced)", async () => {
      vi.useRealTimers(); // Use real timers for this test
      const onSubmitFeedback = vi.fn();
      const user = userEvent.setup();

      render(
        <SlideCard
          slide={mockSlide}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={false}
        />,
      );

      const lastFrameCheckbox = screen
        .getByText("Pick Last Frame")
        .parentElement?.querySelector('input[type="checkbox"]');
      expect(lastFrameCheckbox).not.toBeNull();

      await user.click(lastFrameCheckbox!);

      // Should not call immediately
      expect(onSubmitFeedback).not.toHaveBeenCalled();

      // Wait for debounce (600ms to be safe)
      await waitFor(
        () => {
          expect(onSubmitFeedback).toHaveBeenCalledWith(
            expect.objectContaining({
              slideNumber: 1,
              isFirstFramePicked: false,
              isLastFramePicked: true,
            }),
          );
        },
        { timeout: 1000 },
      );
    });

    it("should support picking both frames independently", () => {
      const onSubmitFeedback = vi.fn();
      const initialFeedback: SlideFeedbackData = {
        slideNumber: 1,
        isFirstFramePicked: true,
        isLastFramePicked: true,
        firstFrameHasUsefulContent: null,
        lastFrameHasUsefulContent: null,
        framesSameness: null,
      };

      render(
        <SlideCard
          slide={mockSlide}
          initialFeedback={initialFeedback}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={false}
        />,
      );

      const firstFrameCheckbox = screen
        .getByText("Pick First Frame")
        .parentElement?.querySelector('input[type="checkbox"]');
      const lastFrameCheckbox = screen
        .getByText("Pick Last Frame")
        .parentElement?.querySelector('input[type="checkbox"]');

      // Both should be checked when both are picked in initial feedback
      expect(firstFrameCheckbox).toBeChecked();
      expect(lastFrameCheckbox).toBeChecked();
    });

    it("should reflect initial feedback state", () => {
      const onSubmitFeedback = vi.fn();
      const initialFeedback: SlideFeedbackData = {
        slideNumber: 1,
        isFirstFramePicked: true,
        isLastFramePicked: false,
        firstFrameHasUsefulContent: null,
        lastFrameHasUsefulContent: null,
        framesSameness: null,
      };

      render(
        <SlideCard
          slide={mockSlide}
          initialFeedback={initialFeedback}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={false}
        />,
      );

      const firstFrameCheckbox = screen
        .getByText("Pick First Frame")
        .parentElement?.querySelector('input[type="checkbox"]');
      const lastFrameCheckbox = screen
        .getByText("Pick Last Frame")
        .parentElement?.querySelector('input[type="checkbox"]');

      expect(firstFrameCheckbox).toBeChecked();
      expect(lastFrameCheckbox).not.toBeChecked();
    });
  });

  describe("Frame Sameness Reporting", () => {
    it("should render frame sameness reporting button", () => {
      const onSubmitFeedback = vi.fn();

      render(
        <SlideCard
          slide={mockSlide}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={false}
        />,
      );

      // Should show the report button
      expect(
        screen.getByRole("button", { name: /report/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/different useful content/i)).toBeInTheDocument();
    });

    it("should not show frame sameness in show-only-picked mode", () => {
      const onSubmitFeedback = vi.fn();
      const initialFeedback: SlideFeedbackData = {
        slideNumber: 1,
        isFirstFramePicked: true,
        isLastFramePicked: false,
        firstFrameHasUsefulContent: null,
        lastFrameHasUsefulContent: null,
        framesSameness: null,
      };

      render(
        <SlideCard
          slide={mockSlide}
          initialFeedback={initialFeedback}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={true}
        />,
      );

      expect(
        screen.queryByText(/different useful content/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("Conditional Rendering", () => {
    it("should show only picked frames when showOnlyPickedFrames is true", () => {
      const onSubmitFeedback = vi.fn();
      const initialFeedback: SlideFeedbackData = {
        slideNumber: 1,
        isFirstFramePicked: true,
        isLastFramePicked: false,
        firstFrameHasUsefulContent: null,
        lastFrameHasUsefulContent: null,
        framesSameness: null,
      };

      render(
        <SlideCard
          slide={mockSlide}
          initialFeedback={initialFeedback}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={true}
        />,
      );

      expect(screen.getByText("Pick First Frame")).toBeInTheDocument();
      expect(screen.queryByText("Pick Last Frame")).not.toBeInTheDocument();
    });

    it("should show both frames when both are picked in show-only-picked mode", () => {
      const onSubmitFeedback = vi.fn();
      const initialFeedback: SlideFeedbackData = {
        slideNumber: 1,
        isFirstFramePicked: true,
        isLastFramePicked: true,
        firstFrameHasUsefulContent: null,
        lastFrameHasUsefulContent: null,
        framesSameness: null,
      };

      render(
        <SlideCard
          slide={mockSlide}
          initialFeedback={initialFeedback}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={true}
        />,
      );

      expect(screen.getByText("Pick First Frame")).toBeInTheDocument();
      expect(screen.getByText("Pick Last Frame")).toBeInTheDocument();
    });

    it("should show all frames when showOnlyPickedFrames is false", () => {
      const onSubmitFeedback = vi.fn();

      render(
        <SlideCard
          slide={mockSlide}
          onSubmitFeedback={onSubmitFeedback}
          showOnlyPickedFrames={false}
        />,
      );

      expect(screen.getByText("Pick First Frame")).toBeInTheDocument();
      expect(screen.getByText("Pick Last Frame")).toBeInTheDocument();
    });
  });
});
// Note: Debounce behavior is already tested in the "should call onSubmitFeedback when
// first/last frame is picked (debounced)" tests above, which verify that debouncing works correctly.
