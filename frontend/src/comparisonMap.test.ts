import { describe, expect, it } from "vitest";

import {
  NEUTRAL_MAP, berryRoleOf, comparisonIslands, mapRequestFields, selectIsland, toggleFavorite,
  type ComparisonMap,
} from "./comparisonMap";
import type { Island } from "./types";

const island = (name: string, expert: boolean): Island => ({
  name, favorite_berries: [], user_picks: true, ratings: [], expert,
  expert_speed: expert ? { main: 0.8, penalty: 1.35 } : null,
});
const CYAN = island("Cyan Beach (Expert)", true);
const pick = (...berries: string[]) => berries.reduce(toggleFavorite, NEUTRAL_MAP);

describe("comparisonMap", () => {
  it("starts on Normal with no favorites", () => {
    expect(NEUTRAL_MAP).toEqual({ island: null, favorites: [], main: null, weeklyBonus: "berry_strength" });
  });

  it("offers only the expert maps, in catalog order", () => {
    const list = [island("Greengrass Isle", false), island("Greengrass Isle (Expert)", true), CYAN];
    expect(comparisonIslands(list).map((i) => i.name)).toEqual(["Greengrass Isle (Expert)", "Cyan Beach (Expert)"]);
  });

  it("makes the first pick the main and caps at three", () => {
    const map = pick("Oran", "Pecha", "Pamtre", "Grepa");
    expect(map.favorites).toEqual(["Oran", "Pecha", "Pamtre"]);
    expect(map.main).toBe("Oran");
  });

  it("leaves the main slot vacant on removal and refills it with the next pick", () => {
    const removed = toggleFavorite(pick("Oran", "Pecha"), "Oran");
    expect(removed).toMatchObject({ favorites: ["Pecha"], main: null });
    expect(toggleFavorite(removed, "Grepa")).toMatchObject({ favorites: ["Pecha", "Grepa"], main: "Grepa" });
  });

  it("keeps favorites when switching maps and fills a vacant main on an expert one", () => {
    const vacant = toggleFavorite(pick("Oran", "Pecha"), "Oran");
    const expert = selectIsland(vacant, CYAN);
    expect(expert).toMatchObject({ island: CYAN.name, favorites: ["Pecha"], main: "Pecha" });
    expect(selectIsland(expert, null)).toMatchObject({ island: null, favorites: ["Pecha"] });
  });

  it("reads roles: never main off an expert map", () => {
    const map: ComparisonMap = { ...pick("Oran", "Pecha"), island: CYAN.name };
    expect(berryRoleOf(map, true, "Oran")).toBe("main");
    expect(berryRoleOf(map, true, "Pecha")).toBe("sub");
    expect(berryRoleOf(map, true, "Chesto")).toBe("none");
    expect(berryRoleOf(map, false, "Oran")).toBe("sub");
  });

  it("sends main and weekly bonus only on an expert map", () => {
    const map: ComparisonMap = { ...pick("Oran"), weeklyBonus: "ingredient" };
    expect(mapRequestFields(map, false)).toEqual({
      island: null, favorite_berries: ["Oran"], main_favorite: null, weekly_bonus: null,
    });
    expect(mapRequestFields({ ...map, island: CYAN.name }, true)).toEqual({
      island: CYAN.name, favorite_berries: ["Oran"], main_favorite: "Oran", weekly_bonus: "ingredient",
    });
  });
});
