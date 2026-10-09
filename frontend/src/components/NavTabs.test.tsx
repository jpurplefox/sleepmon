import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { LanguageProvider } from "../i18n";
import { ROUTES } from "../routes";
import { NavTabs } from "./NavTabs";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <LanguageProvider>
      <Router hook={hook}>
        <NavTabs />
      </Router>
    </LanguageProvider>,
  );
}

describe("NavTabs", () => {
  it("renders one link per tool, in order, pointing at its route", () => {
    renderAt(ROUTES.box);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([ROUTES.compare, ROUTES.teamAnalysis, ROUTES.box, ROUTES.savedTeams]);
  });

  it("sets the saved tools apart from the analysis ones with one separator", () => {
    const { container } = renderAt(ROUTES.compare);
    const row = container.querySelector(".tabs")!;
    const seps = row.querySelectorAll(".nav__sep");
    expect(seps).toHaveLength(1);
    expect(seps[0].previousElementSibling).toHaveAttribute("href", ROUTES.teamAnalysis);
    expect(seps[0].nextElementSibling).toHaveAttribute("href", ROUTES.box);
  });

  it("names the saved tools \"My box\" and \"My teams\"", () => {
    renderAt(ROUTES.compare);
    const row = document.querySelector(".tabs") as HTMLElement;
    expect(within(row).getByRole("link", { name: "My box" })).toHaveAttribute("href", ROUTES.box);
    expect(within(row).getByRole("link", { name: "My teams" })).toHaveAttribute("href", ROUTES.savedTeams);
  });

  it("marks the link matching the current path as the current page", () => {
    renderAt(ROUTES.compare);
    const current = screen.getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", ROUTES.compare);
    expect(current).toHaveClass("tab--active");
  });

  it("marks exactly one tool active for the current path", () => {
    renderAt(ROUTES.teamAnalysis);
    const active = screen.getAllByRole("link").filter((a) => a.classList.contains("tab--active"));
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute("href", ROUTES.teamAnalysis);
  });

  describe("narrow-screen menu", () => {
    const menuButton = () => screen.getByRole("button", { name: /^Menu/ });
    const panel = () => document.getElementById("nav-menu-panel");

    it("names the current tool on the button and lists every tool when opened", () => {
      renderAt(ROUTES.compare);
      expect(menuButton()).toHaveAccessibleName("Menu — Comparison");
      expect(menuButton()).toHaveAttribute("aria-expanded", "false");
      expect(panel()).toBeNull();

      fireEvent.click(menuButton());

      expect(menuButton()).toHaveAttribute("aria-expanded", "true");
      const hrefs = within(panel()!).getAllByRole("link").map((a) => a.getAttribute("href"));
      expect(hrefs).toEqual([ROUTES.compare, ROUTES.teamAnalysis, ROUTES.box, ROUTES.savedTeams]);
      expect(within(panel()!).getByRole("link", { current: "page" })).toHaveAttribute("href", ROUTES.compare);
    });

    it("closes once a tool is picked", () => {
      renderAt(ROUTES.box);
      fireEvent.click(menuButton());
      fireEvent.click(within(panel()!).getByRole("link", { name: "Comparison" }));
      expect(panel()).toBeNull();
      expect(menuButton()).toHaveAccessibleName("Menu — Comparison");
    });

    it("closes on Escape and on a tap outside", () => {
      renderAt(ROUTES.box);
      fireEvent.click(menuButton());
      fireEvent.keyDown(document, { key: "Escape" });
      expect(panel()).toBeNull();
      expect(menuButton()).toHaveFocus();

      fireEvent.click(menuButton());
      fireEvent.pointerDown(document.body);
      expect(panel()).toBeNull();
    });
  });
});
