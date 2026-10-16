import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../i18n";
import { CatchSteps, STEP_MS } from "./CatchSteps";

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
const shownFrame = () => document.querySelector(".landing-stage__frame:not([aria-hidden])");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("CatchSteps", () => {
  it("starts on the first step and moves on by itself", () => {
    renderSteps();
    expect(current()).toHaveTextContent("Upload the screenshots");
    expect(shownFrame()).toHaveClass("landing-stage__frame--upload");
    act(() => vi.advanceTimersByTime(STEP_MS));
    expect(current()).toHaveTextContent("Evolve it");
    expect(shownFrame()).toHaveClass("landing-stage__frame--evolve");
  });

  it("jumps to a step on click and gives it the full time", () => {
    renderSteps();
    act(() => vi.advanceTimersByTime(STEP_MS - 100));
    fireEvent.click(screen.getByRole("button", { name: /Pick one from your box/ }));
    expect(current()).toHaveTextContent("Pick one from your box");
    expect(shownFrame()).toHaveClass("landing-stage__frame--pick");
    act(() => vi.advanceTimersByTime(STEP_MS - 100));
    expect(current()).toHaveTextContent("Pick one from your box");
    act(() => vi.advanceTimersByTime(100));
    expect(current()).toHaveTextContent("Pick your island and comparison level");
  });

  it("wraps from the last step back to the first", () => {
    renderSteps();
    fireEvent.click(screen.getByRole("button", { name: /Compare them/ }));
    act(() => vi.advanceTimersByTime(STEP_MS));
    expect(current()).toHaveTextContent("Upload the screenshots");
  });

  it("with reduced motion shows the outcome and stays put until clicked", () => {
    renderSteps(true);
    expect(current()).toHaveTextContent("Compare them");
    act(() => vi.advanceTimersByTime(STEP_MS * 3));
    expect(current()).toHaveTextContent("Compare them");
    fireEvent.click(screen.getByRole("button", { name: /Evolve it/ }));
    expect(shownFrame()).toHaveClass("landing-stage__frame--evolve");
  });
});
