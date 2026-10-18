import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../i18n";
import { CatchSteps, STEP_DURATIONS, timeline } from "./CatchSteps";

function renderSteps(reducedMotion = false) {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  localStorage.setItem("sleepmon.lang", "en");
  render(
    <LanguageProvider>
      <CatchSteps />
    </LanguageProvider>,
  );
}

const current = () => screen.getByRole("button", { current: "step" });
const shownFrame = () => document.querySelector(".landing-stage__frame:not([aria-hidden])") as HTMLElement;
const step = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("timeline", () => {
  it("walks the map list one entry at a time down to the target, then clicks and applies", () => {
    const times = timeline("settings", 4);
    expect(times).toHaveLength(4 + 2);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times[times.length - 1]).toBeLessThan(STEP_DURATIONS.settings);
  });
});

describe("CatchSteps", () => {
  it("starts on the first step and moves on by itself", () => {
    renderSteps();
    expect(current()).toHaveTextContent("Upload the screenshots");
    expect(shownFrame()).toHaveClass("landing-stage__frame--upload");
    wait(STEP_DURATIONS.upload);
    expect(current()).toHaveTextContent("Evolve it");
  });

  it("jumps to a step on click and gives it its full time", () => {
    renderSteps();
    wait(STEP_DURATIONS.upload - 100);
    step(/Pick one from your box/);
    expect(shownFrame()).toHaveClass("landing-stage__frame--pick");
    wait(STEP_DURATIONS.pick - 100);
    expect(current()).toHaveTextContent("Pick one from your box");
    wait(100);
    expect(current()).toHaveTextContent("Pick your map and comparison level");
  });

  it("wraps from the last step back to the first", () => {
    renderSteps();
    step(/Compare them/);
    wait(STEP_DURATIONS.compare);
    expect(current()).toHaveTextContent("Upload the screenshots");
  });

  it("brings the screenshots in one by one, then reads them", () => {
    renderSteps();
    const upload = () => shownFrame().querySelector(".landing-upload");
    expect(upload()).not.toHaveClass("is-p1");
    const times = timeline("upload", 0);
    wait(times[0]);
    expect(upload()).toHaveClass("is-p1");
    expect(upload()).not.toHaveClass("is-p2");
    wait(times[times.length - 1] - times[0]);
    expect(upload()).toHaveClass("is-p3");
  });

  it("marks the Box suggestion as picked once the pointer clicks it", () => {
    renderSteps();
    step(/Pick one from your box/);
    const row = () => shownFrame().querySelector(".landing-demo__row");
    expect(row()).not.toHaveClass("is-picked");
    const times = timeline("pick", 0);
    wait(times[times.length - 1]);
    expect(row()).toHaveClass("is-picked");
  });

  it("evolves after the pointer clicks the evolve button", () => {
    renderSteps();
    step(/Evolve it/);
    const after = () => shownFrame().querySelector(".landing-stage__shot--catch-evolve-after");
    expect(after()).not.toHaveClass("is-on");
    const evolveTimes = timeline("evolve", 0);
    wait(evolveTimes[evolveTimes.length - 1]);
    expect(after()).toHaveClass("is-on");
  });

  it("applies the map only once the pointer has clicked it", () => {
    renderSteps();
    step(/Pick your map/);
    const applied = () => shownFrame().querySelector(".landing-stage__layer--column");
    expect(applied()).toHaveClass("is-off");
    wait(STEP_DURATIONS.settings - 100);
    expect(applied()).not.toHaveClass("is-off");
  });

  it("with reduced motion shows every step's outcome and stays put until clicked", () => {
    renderSteps(true);
    expect(current()).toHaveTextContent("Compare them");
    expect(shownFrame().querySelector(".landing-duel")).toHaveClass("is-p3");
    wait(STEP_DURATIONS.compare * 3);
    expect(current()).toHaveTextContent("Compare them");
    step(/Evolve it/);
    expect(shownFrame().querySelector(".landing-stage__shot--catch-evolve-after")).toHaveClass("is-on");
  });
});
