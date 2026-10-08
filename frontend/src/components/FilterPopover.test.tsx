import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilterPopover } from "./FilterPopover";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <p>Outside</p>
      <FilterPopover open={open} onOpenChange={setOpen} triggerLabel="Filter" triggerContent="Filter">
        <button type="button" role="option" aria-selected="false">
          Option
        </button>
      </FilterPopover>
    </>
  );
}

describe("FilterPopover", () => {
  afterEach(() => vi.restoreAllMocks());

  // jsdom has no layout: the panel reports the box given, on a 375px screen.
  const panelAt = (left: number, right: number) => {
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(375);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left, right, width: right - left, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON() {},
    });
  };
  const panel = () => document.querySelector<HTMLElement>(".filter-pop")!;

  it("shifts left just enough to stay on screen when the trigger is near the right edge", () => {
    panelAt(300, 500);
    render(<Harness />);
    // Ends at 500 on a 375px screen: back by 141 so it ends at 375 - 16.
    expect(panel().style.left).toBe("-141px");
  });

  it("never shifts past the screen's left edge", () => {
    // A panel wider than the screen: its left edge stops at 16, the rest overflows right.
    panelAt(100, 500);
    render(<Harness />);
    expect(panel().style.left).toBe("-84px");
  });

  it("stays put when the panel fits", () => {
    panelAt(16, 216);
    render(<Harness />);
    expect(panel().style.left).toBe("");
  });

  // A tap fires pointer events everywhere; iOS only synthesizes mousedown on clickable
  // elements, so a tap on empty space must close the panel through pointerdown.
  it("closes on a tap outside, not on one inside", () => {
    render(<Harness />);
    fireEvent.pointerDown(screen.getByRole("option"));
    expect(screen.getByRole("option")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(screen.queryByRole("option")).toBeNull();
  });
});
