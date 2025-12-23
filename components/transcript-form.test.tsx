import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorMessage, TranscriptForm } from "./transcript-form";

describe("TranscriptForm", () => {
  it("shows loading spinner when pending", () => {
    const action = vi.fn();
    render(<TranscriptForm action={action} isPending={true} />);

    expect(screen.getByRole("button")).toHaveTextContent(
      "Starting Workflow...",
    );

    // Look for the spinner
    // We will add data-testid="loading-spinner" to the spinner
    const spinner = screen.getByTestId("loading-spinner");
    expect(spinner).toBeInTheDocument();
  });
});

describe("ErrorMessage", () => {
  it("has alert role for accessibility", () => {
    render(<ErrorMessage message="Test error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("❌ Test error")).toBeInTheDocument();
  });
});
