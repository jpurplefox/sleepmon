import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../i18n";
import { MARKS } from "./demo";
import { LevelupDemo, levelupSchedule } from "./LevelupDemo";

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

const card = (i: number) => document.querySelectorAll(".landing-levelup")[i];
const open = (i: number) => card(i).querySelector(".landing-levelup__tip")!.classList.contains("is-on");
const lit = (i: number) => card(i).querySelectorAll(".landing-levelup__row.is-on").length;
const rowCounts = MARKS.en.levelup.map((c) => c.rows.length);
const { times, firstPhase, loopMs } = levelupSchedule(rowCounts);
// ms when phase `k` (1-based) starts.
const phaseAt = (k: number) => times[k - 1];
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("levelupSchedule", () => {
  it("runs the cards one after the other, each ending with a close", () => {
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(firstPhase).toEqual([0, rowCounts[0] + 4]);
    expect(loopMs).toBeGreaterThan(times[times.length - 1]);
  });
});

describe("LevelupDemo", () => {
  it("opens the first card's gains, lights them, closes, then does the second", () => {
    renderDemo();
    expect(open(0)).toBe(false);
    wait(phaseAt(3));
    expect(open(0)).toBe(true);
    expect(open(1)).toBe(false);
    wait(phaseAt(3 + rowCounts[0]) - phaseAt(3));
    expect(lit(0)).toBe(rowCounts[0]);
    wait(phaseAt(firstPhase[1]) - phaseAt(3 + rowCounts[0]));
    expect(open(0)).toBe(false);
    wait(phaseAt(firstPhase[1] + 3) - phaseAt(firstPhase[1]));
    expect(open(1)).toBe(true);
    wait(loopMs - phaseAt(firstPhase[1] + 3));
    expect(open(0)).toBe(false);
    expect(open(1)).toBe(false);
  });

  it("shows one pointer at a time", () => {
    renderDemo();
    const shown = () => document.querySelectorAll(".landing-levelup .landing-pointer:not(.is-gone)").length;
    expect(shown()).toBe(0);
    // Step through every phase of the loop.
    let elapsed = 0;
    for (const ms of [...times, loopMs]) {
      wait(ms - elapsed);
      elapsed = ms;
      expect(shown()).toBeLessThanOrEqual(1);
    }
  });

  it("hands the turn from the first card to the second when the first closes", () => {
    renderDemo();
    const active = () => [0, 1].map((i) => card(i).classList.contains("is-active"));
    expect(active()).toEqual([true, false]);
    wait(phaseAt(firstPhase[1]));
    expect(active()).toEqual([false, true]);
    wait(loopMs - phaseAt(firstPhase[1]));
    expect(active()).toEqual([true, false]);
  });

  it("with reduced motion holds both cards open with every gain lit", () => {
    renderDemo(true);
    expect(open(0) && open(1)).toBe(true);
    expect([lit(0), lit(1)]).toEqual(rowCounts);
  });
});
