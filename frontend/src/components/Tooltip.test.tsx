import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "./Tooltip";

// Mock layout so `position()` computes a real, non-zero offset instead of the
// jsdom default of all-zero rects (which would be indistinguishable from the
// unmeasured `left: 0` CSS default and defeat the point of these tests).
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains("tooltip")) {
      return { left: 100, width: 50, top: 0, right: 150, bottom: 0, height: 0, x: 100, y: 0, toJSON() {} };
    }
    return { left: 0, width: 0, top: 0, right: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} };
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(80);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function bubbleOf(triggerLabel: string) {
  return screen.getByText(triggerLabel).closest(".tooltip")!.querySelector(".tooltip__bubble") as HTMLElement;
}

describe("Tooltip", () => {
  it("never shows the bubble without a computed left offset", () => {
    render(
      <Tooltip content="Hint">
        <span>Trigger</span>
      </Tooltip>,
    );
    const bubble = bubbleOf("Trigger");

    // Closed at rest: not visible.
    expect(bubble.style.display).toBe("none");

    fireEvent.mouseEnter(bubble.closest(".tooltip")!);

    // Whenever it is visible, the position must already be committed — never
    // painted at the CSS resting position (left: 0) and then jumped.
    if (bubble.style.display !== "none") {
      expect(bubble.style.left).not.toBe("");
      expect(bubble.style.left).not.toBe("0px");
    }
  });

  it("opens on mouse hover and closes on mouse leave", () => {
    render(
      <Tooltip content="Hint">
        <span>Trigger</span>
      </Tooltip>,
    );
    const wrap = screen.getByText("Trigger").closest(".tooltip")!;
    const bubble = bubbleOf("Trigger");

    fireEvent.mouseEnter(wrap);
    expect(bubble.style.display).toBe("flex");
    expect(bubble.style.left).toBe("-15px");

    fireEvent.mouseLeave(wrap);
    expect(bubble.style.display).toBe("none");
  });

  it("opens on keyboard focus and closes on blur", () => {
    render(
      <Tooltip content="Hint">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const bubble = bubbleOf("Trigger");
    const trigger = screen.getByText("Trigger");

    fireEvent.focus(trigger);
    expect(bubble.style.display).toBe("flex");
    expect(bubble.style.left).toBe("-15px");

    fireEvent.blur(trigger);
    expect(bubble.style.display).toBe("none");
  });
});
