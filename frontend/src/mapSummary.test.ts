import { describe, expect, it } from "vitest";

import { mapSummary } from "./mapSummary";

const base = {
  island: "Greengrass Isle",
  berries: [],
  expert: false,
  areaBonusPct: 0,
  weeklyBonus: "berry_strength" as const,
};

describe("mapSummary", () => {
  it("shows nothing but 'no map' when no island is selected", () => {
    expect(mapSummary({ ...base, island: null, berries: ["Leppa"], areaBonusPct: 35 })).toEqual({
      name: null,
      berries: [],
      areaPct: null,
      weeklyBonus: null,
    });
  });

  it("keeps each favorite slot in its place, open ones included", () => {
    const s = mapSummary({ ...base, island: "Greengrass Isle (Expert)", berries: ["", "Grepa", "Leppa"], expert: true });
    expect(s.berries).toEqual(["", "Grepa", "Leppa"]);
  });

  it("hides an area bonus of 0 and shows a positive one, rounded", () => {
    expect(mapSummary({ ...base, areaBonusPct: 0 }).areaPct).toBeNull();
    expect(mapSummary({ ...base, areaBonusPct: 35 }).areaPct).toBe(35);
    expect(mapSummary({ ...base, areaBonusPct: 12.6 }).areaPct).toBe(13);
  });

  it("carries the weekly bonus only on an expert map", () => {
    expect(mapSummary({ ...base, weeklyBonus: "ingredient" }).weeklyBonus).toBeNull();
    expect(mapSummary({ ...base, expert: true, weeklyBonus: "ingredient" }).weeklyBonus).toBe("ingredient");
  });
});
