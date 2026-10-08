import { describe, expect, it } from "vitest";

import {
  NEUTRAL_MAP, berryRoleOf, comparisonIslands, mainOf, mapRequestFields, selectIsland, toggleFavorite,
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
    expect(NEUTRAL_MAP).toEqual({ island: null, favorites: [], weeklyBonus: "berry_strength" });
  });

  it("offers only the expert maps, in catalog order", () => {
    const list = [island("Greengrass Isle", false), island("Greengrass Isle (Expert)", true), CYAN];
    expect(comparisonIslands(list).map((i) => i.name)).toEqual(["Greengrass Isle (Expert)", "Cyan Beach (Expert)"]);
  });

  it("makes slot 1 the main on an expert map only, and caps at three", () => {
    const map = pick("Oran", "Pecha", "Pamtre", "Grepa");
    expect(map.favorites).toEqual(["Oran", "Pecha", "Pamtre"]);
    expect(mainOf(map, true)).toBe("Oran");
    expect(mainOf(map, false)).toBeNull();
  });

  it("leaves a removed berry's slot open, the main's included, and refills it next", () => {
    const noMain = toggleFavorite(pick("Oran", "Pecha", "Pamtre"), "Oran");
    expect(noMain.favorites).toEqual(["", "Pecha", "Pamtre"]);
    expect(mainOf(noMain, true)).toBeNull();
    expect(mainOf(toggleFavorite(noMain, "Grepa"), true)).toBe("Grepa");

    const noSecond = toggleFavorite(pick("Oran", "Pecha", "Pamtre"), "Pecha");
    expect(noSecond.favorites).toEqual(["Oran", "", "Pamtre"]);
  });

  it("keeps the slots when switching maps", () => {
    const open = toggleFavorite(pick("Oran", "Pecha"), "Oran");
    const expert = selectIsland(open, CYAN);
    expect(expert).toEqual({ ...open, island: CYAN.name });
    expect(mainOf(expert, true)).toBeNull();
    expect(selectIsland(expert, null).favorites).toEqual(["", "Pecha"]);
  });

  it("reads roles: never main off an expert map", () => {
    const map: ComparisonMap = { ...pick("Oran", "Pecha"), island: CYAN.name };
    expect(berryRoleOf(map, true, "Oran")).toBe("main");
    expect(berryRoleOf(map, true, "Pecha")).toBe("sub");
    expect(berryRoleOf(map, true, "Chesto")).toBe("none");
    expect(berryRoleOf(map, false, "Oran")).toBe("sub");
  });

  it("sends the picked berries without open slots, and main and weekly bonus only on an expert map", () => {
    const map: ComparisonMap = { ...toggleFavorite(pick("Oran", "Pecha"), "Oran"), weeklyBonus: "ingredient" };
    expect(mapRequestFields(map, false)).toEqual({
      island: null, favorite_berries: ["Pecha"], main_favorite: null, weekly_bonus: null,
    });
    const full: ComparisonMap = { ...pick("Oran", "Pecha"), island: CYAN.name, weeklyBonus: "ingredient" };
    expect(mapRequestFields(full, true)).toEqual({
      island: CYAN.name, favorite_berries: ["Oran", "Pecha"], main_favorite: "Oran", weekly_bonus: "ingredient",
    });
  });
});
