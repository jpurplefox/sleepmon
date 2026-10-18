import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../i18n";
import { SHARE_LOOP_MS, SHARE_TIMES, ShareDemo } from "./ShareDemo";

function renderDemo(reducedMotion = false) {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  localStorage.setItem("sleepmon.lang", "en");
  render(
    <LanguageProvider>
      <ShareDemo />
    </LanguageProvider>,
  );
}

const copied = () => document.querySelector(".landing-stage__shot--share-copied");
const bubble = () => document.querySelector(".landing-chat");
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("ShareDemo", () => {
  it("copies the link, then the link arrives in a chat with its preview, and starts over", () => {
    renderDemo();
    expect(copied()).not.toHaveClass("is-on");
    expect(bubble()).not.toHaveClass("is-on");
    wait(SHARE_TIMES[2]);
    expect(copied()).toHaveClass("is-on");
    expect(bubble()).not.toHaveClass("is-on");
    wait(SHARE_TIMES[3] - SHARE_TIMES[2]);
    expect(bubble()).toHaveClass("is-on");
    wait(SHARE_LOOP_MS - SHARE_TIMES[3]);
    expect(copied()).not.toHaveClass("is-on");
    expect(bubble()).not.toHaveClass("is-on");
  });

  it("with reduced motion holds the outcome", () => {
    renderDemo(true);
    expect(bubble()).toHaveClass("is-on");
    wait(SHARE_LOOP_MS * 2);
    expect(bubble()).toHaveClass("is-on");
  });
});
