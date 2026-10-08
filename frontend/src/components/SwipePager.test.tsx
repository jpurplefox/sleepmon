import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SwipePager } from "./SwipePager";

// jsdom has no layout: fake a track of 100px-wide slides scrolled by `scroll`.
const SLIDE = 100;
let scroll = 0;

beforeEach(() => {
  scroll = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const parent = this.parentElement;
    const left =
      parent?.dataset.testid === "track"
        ? Array.from(parent.children).indexOf(this) * SLIDE - scroll
        : 0;
    return { left, right: left + SLIDE, width: SLIDE, top: 0, bottom: 0, height: 0, x: left, y: 0, toJSON() {} };
  });
  vi.spyOn(HTMLElement.prototype, "scrollLeft", "get").mockImplementation(() => scroll);
  HTMLElement.prototype.scrollTo = vi.fn(function (this: HTMLElement, opts?: ScrollToOptions | number) {
    scroll = typeof opts === "object" ? (opts.left ?? scroll) : scroll;
    this.dispatchEvent(new Event("scroll"));
  }) as unknown as typeof HTMLElement.prototype.scrollTo;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({ keys }: { keys: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  return (
    <>
      <SwipePager
        track={track}
        label="Cards"
        items={keys.map((k) => ({ key: k, label: `Show ${k}`, icon: k }))}
      />
      <div ref={track} data-testid="track">
        {keys.map((k) => (
          <div key={k} />
        ))}
      </div>
    </>
  );
}

const current = () => screen.getByRole("button", { current: true });

describe("SwipePager", () => {
  it("marks the slide in view and follows a swipe", () => {
    render(<Harness keys={["a", "b", "c"]} />);
    expect(current()).toHaveAccessibleName("Show a");

    act(() => {
      scroll = SLIDE * 2;
      screen.getByTestId("track").dispatchEvent(new Event("scroll"));
    });
    expect(current()).toHaveAccessibleName("Show c");
  });

  it("scrolls to a slide when its button is tapped", () => {
    render(<Harness keys={["a", "b", "c"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Show b" }));
    expect(scroll).toBe(SLIDE);
    expect(current()).toHaveAccessibleName("Show b");
  });

  it("brings a newly added slide into view", () => {
    const { rerender } = render(<Harness keys={["a", "add"]} />);
    rerender(<Harness keys={["a", "b", "add"]} />);
    expect(scroll).toBe(SLIDE);
    expect(current()).toHaveAccessibleName("Show b");
  });

  it("follows the slide in view when the order changes", () => {
    const { rerender } = render(<Harness keys={["a", "b", "c"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Show c" }));

    // "c" becomes the first slide (made the base): the view goes with it.
    rerender(<Harness keys={["c", "b", "a"]} />);
    expect(scroll).toBe(0);
    expect(current()).toHaveAccessibleName("Show c");
  });
});
