import { render, screen } from "@testing-library/react";
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
    expect(hrefs).toEqual([ROUTES.box, ROUTES.compare, ROUTES.teamAnalysis]);
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
});
