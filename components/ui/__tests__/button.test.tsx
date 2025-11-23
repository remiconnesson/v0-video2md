import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders provided children", () => {
    render(<Button>Click me</Button>);

    expect(
      screen.getByRole("button", { name: /click me/i }),
    ).toBeInTheDocument();
  });

  it("supports rendering as a different element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="#test">Open link</a>
      </Button>,
    );

    expect(screen.getByRole("link", { name: /open link/i })).toHaveAttribute(
      "data-slot",
      "button",
    );
  });
});
