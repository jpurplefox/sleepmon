import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Placeholder } from "./Placeholder";

describe("Placeholder", () => {
  it("renders its message as a status region", () => {
    render(<Placeholder>Your box is empty</Placeholder>);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("Your box is empty");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("marks itself busy only while loading", () => {
    const { rerender } = render(<Placeholder>Empty</Placeholder>);
    expect(screen.getByRole("status")).not.toHaveAttribute("aria-busy");

    rerender(<Placeholder loading>Loading…</Placeholder>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("keeps an inline action inside the placeholder", () => {
    render(
      <Placeholder>
        No matches <button type="button">Clear filters</button>
      </Placeholder>,
    );
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("appends an extra class next to the base one", () => {
    render(<Placeholder className="mt">x</Placeholder>);
    expect(screen.getByRole("status")).toHaveClass("placeholder", "mt");
  });
});
