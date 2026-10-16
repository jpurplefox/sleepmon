import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHashScroll } from "./useHashScroll";

function Probe() {
  useHashScroll("faq");
  return <section id="faq">FAQ</section>;
}

afterEach(() => history.replaceState(null, "", "/"));

describe("useHashScroll", () => {
  it("scrolls to the section when the page opens on its hash", () => {
    history.replaceState(null, "", "/#faq");
    const spy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    render(<Probe />);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("scrolls again when the app navigates to the hash", () => {
    const spy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    render(<Probe />);
    expect(spy).not.toHaveBeenCalled();
    act(() => {
      history.pushState(null, "", "/#faq");
      dispatchEvent(new Event("pushState"));
    });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("ignores other hashes", () => {
    history.replaceState(null, "", "/#other");
    const spy = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    render(<Probe />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
