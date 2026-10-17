import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../i18n";
import { LEVELUP_LOOP_MS, LevelupDemo, levelupTimes } from "./LevelupDemo";

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
      <LevelupDemo />
    </LanguageProvider>,
  );
}

const tip = () => document.querySelector(".landing-levelup__tip");
const lit = () => document.querySelectorAll(".landing-levelup__row.is-on").length;
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("LevelupDemo", () => {
  it("opens the gains on tap, lights them one by one, and starts over", () => {
    renderDemo();
    const rows = document.querySelectorAll(".landing-levelup__row").length;
    const times = levelupTimes(rows);
    expect(tip()).not.toHaveClass("is-on");
    wait(times[2]);
    expect(tip()).toHaveClass("is-on");
    expect(lit()).toBe(0);
    wait(times[3] - times[2]);
    expect(lit()).toBe(1);
    wait(times[times.length - 1] - times[3]);
    expect(lit()).toBe(rows);
    wait(LEVELUP_LOOP_MS - times[times.length - 1]);
    expect(tip()).not.toHaveClass("is-on");
  });

  it("with reduced motion holds every gain lit", () => {
    renderDemo(true);
    const rows = document.querySelectorAll(".landing-levelup__row").length;
    expect(tip()).toHaveClass("is-on");
    expect(lit()).toBe(rows);
  });
});
