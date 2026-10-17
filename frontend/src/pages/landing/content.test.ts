import { describe, expect, it } from "vitest";

import { UI } from "../../i18n/ui";
import { ROUTES } from "../../routes";
import { ACCESS_ROWS, CATCH_STEPS, FAQ_HREF, FAQ_ITEMS, USE_CASES, shotUrl } from "./content";

describe("landing content", () => {
  it("builds shot paths per language", () => {
    expect(shotUrl("hero-card-1", "es")).toBe("/landing/es/hero-card-1.jpg");
    expect(shotUrl("levelup-tip-1", "en")).toBe("/landing/en/levelup-tip-1.jpg");
  });

  it("links the FAQ anchor on the landing", () => {
    expect(FAQ_HREF).toBe("/#faq");
  });

  it("lists the four use cases in the player's order, linking to tools", () => {
    expect(USE_CASES.map((c) => c.id)).toEqual(["catch", "share", "plan", "levelup"]);
    expect(USE_CASES.map((c) => c.to)).toEqual([ROUTES.compare, ROUTES.compare, ROUTES.teamAnalysis, ROUTES.box]);
    expect(USE_CASES.filter((c) => c.needsAccount).map((c) => c.id)).toEqual(["catch", "levelup"]);
  });

  it("opens the FAQ with why sleepmon and leaves the expert-map detail for last", () => {
    expect(FAQ_ITEMS.map((i) => i.id)).toEqual([
      "why", "numbers", "ranking", "energy", "inventory", "event", "strength", "expert",
    ]);
  });

  it("has every derived copy key in both languages", () => {
    const keys = [
      ...USE_CASES.flatMap((c) => [`landing.case.${c.id}.title`, `landing.case.${c.id}.body`, `landing.case.${c.id}.alt`, c.linkKey]),
      ...FAQ_ITEMS.flatMap((i) => [`landing.faq.${i.id}.q`, `landing.faq.${i.id}.a`]),
    ];
    for (const lang of ["es", "en"] as const) for (const k of keys) expect(UI[lang][k], `${lang}:${k}`).toBeTruthy();
  });

  it("walks the catch story in the player's order, each step with copy in both languages", () => {
    expect(CATCH_STEPS.map((s) => s.id)).toEqual(["upload", "evolve", "pick", "settings", "compare"]);
    for (const lang of ["es", "en"] as const)
      for (const s of CATCH_STEPS) expect(UI[lang][`landing.catch.step.${s.id}`], `${lang}:${s.id}`).toBeTruthy();
  });

  it("lists what works without an account first, then what an account adds, each in both languages", () => {
    const open = ACCESS_ROWS.filter((r) => r.withoutAccount).map((r) => r.id);
    expect(open).toEqual(["compare", "teams", "share"]);
    expect(ACCESS_ROWS.findIndex((r) => !r.withoutAccount)).toBe(open.length);
    for (const lang of ["es", "en"] as const)
      for (const r of ACCESS_ROWS) expect(UI[lang][`landing.access.row.${r.id}`], `${lang}:${r.id}`).toBeTruthy();
  });
});
