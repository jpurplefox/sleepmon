import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../../i18n";
import { PLAN_DURATIONS, PlanSteps, planTimeline } from "./PlanSteps";

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
      <PlanSteps />
    </LanguageProvider>,
  );
}

const current = () => screen.getByRole("button", { current: "step" });
const shownFrame = () => document.querySelector(".landing-stage__frame:not([aria-hidden])") as HTMLElement;
const step = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const lastTime = (id: Parameters<typeof planTimeline>[0]) => {
  const t = planTimeline(id, 3);
  return t[t.length - 1];
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("PlanSteps", () => {
  it("walks team, map, meals and week in order", () => {
    renderSteps();
    expect(current()).toHaveTextContent("Build your team");
    wait(PLAN_DURATIONS.team);
    expect(current()).toHaveTextContent("Pick the map and its berries");
    wait(PLAN_DURATIONS.map);
    expect(current()).toHaveTextContent("Check your meals' ingredients");
    wait(PLAN_DURATIONS.meals);
    expect(current()).toHaveTextContent("See the week's strength");
  });

  it("deals the five cards in", () => {
    renderSteps();
    const dealt = () => shownFrame().querySelectorAll(".landing-deal__card.is-in").length;
    expect(dealt()).toBe(0);
    wait(lastTime("team"));
    expect(dealt()).toBe(5);
  });

  it("tints the cards only after the berries are picked", () => {
    renderSteps();
    step(/Pick the map/);
    const tinted = () => shownFrame().querySelectorAll(".landing-deal__over.is-on").length;
    const picked = () => shownFrame().querySelectorAll(".landing-demo__pick.is-on").length;
    wait(planTimeline("map", 3)[5]);
    expect(picked()).toBe(3);
    expect(tinted()).toBe(0);
    wait(lastTime("map") - planTimeline("map", 3)[5]);
    expect(tinted()).toBe(5);
  });

  it("lights the recipes, the cooking strength and what is missing", () => {
    renderSteps();
    step(/Check your meals/);
    wait(lastTime("meals"));
    const lit = [...shownFrame().querySelectorAll(".landing-band.is-on")].map((b) => b.getAttribute("data-kind"));
    expect(lit).toEqual(["recipe", "recipe", "recipe", "up", "down"]);
  });

  it("with reduced motion shows the week's figures lit and waits for clicks", () => {
    renderSteps(true);
    expect(current()).toHaveTextContent("See the week's strength");
    expect(shownFrame().querySelectorAll(".landing-band.is-on")).toHaveLength(5);
    wait(PLAN_DURATIONS.week * 2);
    expect(current()).toHaveTextContent("See the week's strength");
  });
});
