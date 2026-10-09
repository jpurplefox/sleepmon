import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "./Tooltip";

// Mock layout so `position()` computes a real, non-zero offset instead of the
// jsdom default of all-zero rects (which would be indistinguishable from the
// unmeasured `left: 0` CSS default and defeat the point of these tests).
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.dataset.testid === "clip") {
      return { left: 0, width: 140, top: 0, right: 140, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} };
    }
    if (this.classList.contains("tooltip")) {
      return { left: 100, width: 50, top: 0, right: 150, bottom: 0, height: 0, x: 100, y: 0, toJSON() {} };
    }
    return { left: 0, width: 0, top: 0, right: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} };
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(80);
  // jsdom has no layout, so the page reports zero width unless given one.
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1024);
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

    fireEvent.pointerEnter(bubble.closest(".tooltip")!, { pointerType: "mouse" });

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

    fireEvent.pointerEnter(wrap, { pointerType: "mouse" });
    expect(bubble.style.display).toBe("flex");
    expect(bubble.style.left).toBe("-15px");

    fireEvent.pointerLeave(wrap, { pointerType: "mouse" });
    expect(bubble.style.display).toBe("none");
  });

  it("clamps to the screen width even when the open bubble has widened the window", () => {
    // Mobile browsers grow innerWidth to fit overflowing content, which includes
    // the bubble itself before it is moved; the page's own width doesn't grow.
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(400);
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(150);
    render(
      <Tooltip content="Hint">
        <span>Trigger</span>
      </Tooltip>,
    );
    const bubble = bubbleOf("Trigger");

    fireEvent.pointerEnter(bubble.closest(".tooltip")!, { pointerType: "mouse" });
    // Trigger at 100–150, bubble 80 wide: its right edge must stop at 150 - 8.
    expect(bubble.style.left).toBe("-38px");
  });

  it("stays inside a scrolling ancestor that would clip it (a swiped card deck)", () => {
    render(
      <div data-testid="clip" style={{ overflowX: "auto" }}>
        <Tooltip content="Hint">
          <span>Trigger</span>
        </Tooltip>
      </div>,
    );
    const bubble = bubbleOf("Trigger");

    fireEvent.pointerEnter(bubble.closest(".tooltip")!, { pointerType: "mouse" });
    // Trigger at 100–150, bubble 80 wide, the deck ends at 140: right edge at 140 - 8.
    expect(bubble.style.left).toBe("-48px");
  });

  it("opens on keyboard focus and closes on blur", () => {
    render(
      <Tooltip content="Hint">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const bubble = bubbleOf("Trigger");
    const trigger = screen.getByText("Trigger");

    act(() => trigger.focus());
    expect(bubble.style.display).toBe("flex");
    expect(bubble.style.left).toBe("-15px");

    act(() => trigger.blur());
    expect(bubble.style.display).toBe("none");
  });

  describe("on a touch screen", () => {
    const tap = (el: Element) => {
      fireEvent.pointerDown(el, { pointerType: "touch" });
      fireEvent.pointerEnter(el, { pointerType: "touch" });
      fireEvent.click(el);
    };
    const setup = () => {
      render(
        <>
          <p>Elsewhere</p>
          <Tooltip content="Hint">
            <span>Trigger</span>
          </Tooltip>
        </>,
      );
      return { trigger: screen.getByText("Trigger"), bubble: bubbleOf("Trigger") };
    };

    it("opens on a tap and closes on a second one", () => {
      const { trigger, bubble } = setup();
      tap(trigger);
      expect(bubble.style.display).toBe("flex");
      tap(trigger);
      expect(bubble.style.display).toBe("none");
    });

    it("closes on a tap anywhere else", () => {
      const { trigger, bubble } = setup();
      tap(trigger);
      fireEvent.pointerDown(screen.getByText("Elsewhere"), { pointerType: "touch" });
      expect(bubble.style.display).toBe("none");
    });

    it("closes on Escape", () => {
      const { trigger, bubble } = setup();
      tap(trigger);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(bubble.style.display).toBe("none");
    });

    it("doesn't stay open from the touch's emulated hover", () => {
      const { trigger, bubble } = setup();
      fireEvent.pointerEnter(trigger.closest(".tooltip")!, { pointerType: "touch" });
      fireEvent.mouseEnter(trigger.closest(".tooltip")!);
      expect(bubble.style.display).toBe("none");
    });
  });
});
