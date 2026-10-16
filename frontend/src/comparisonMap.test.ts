import { describe, expect, it } from "vitest";

import { NEUTRAL_MAP, berryRoleOf, mainOf, mapRequestFields, type ComparisonMap } from "./comparisonMap";
import { toggleFavoriteSlot } from "./favoriteSlots";

const CYAN = "Cyan Beach (Expert)";
const withFavorites = (...favorites: string[]): ComparisonMap => ({ ...NEUTRAL_MAP, favorites });

describe("comparisonMap", () => {
  it("starts on Greengrass Isle with no favorites", () => {
    expect(NEUTRAL_MAP).toEqual({ island: "Greengrass Isle", favorites: [], weeklyBonus: "berry_strength" });
  });

  it("makes slot 1 the main on an expert map only", () => {
    const map = withFavorites("Oran", "Pecha", "Pamtre");
    expect(mainOf(map, true)).toBe("Oran");
    expect(mainOf(map, false)).toBeNull();
    // An open slot 1 leaves the main open.
    expect(mainOf(withFavorites(...toggleFavoriteSlot(map.favorites, "Oran")), true)).toBeNull();
  });

  it("reads roles: never main off an expert map", () => {
    const map: ComparisonMap = { ...withFavorites("Oran", "Pecha"), island: CYAN };
    expect(berryRoleOf(map, true, "Oran")).toBe("main");
    expect(berryRoleOf(map, true, "Pecha")).toBe("sub");
    expect(berryRoleOf(map, true, "Chesto")).toBe("none");
    expect(berryRoleOf(map, false, "Oran")).toBe("sub");
  });

  it("sends the picked berries without open slots, and main and weekly bonus only on an expert map", () => {
    const map: ComparisonMap = { ...withFavorites("", "Pecha"), weeklyBonus: "ingredient" };
    expect(mapRequestFields(map, false)).toEqual({
      island: "Greengrass Isle", favorite_berries: ["Pecha"], main_favorite: null, weekly_bonus: null,
    });
    const full: ComparisonMap = { ...withFavorites("Oran", "Pecha"), island: CYAN, weeklyBonus: "ingredient" };
    expect(mapRequestFields(full, true)).toEqual({
      island: CYAN, favorite_berries: ["Oran", "Pecha"], main_favorite: "Oran", weekly_bonus: "ingredient",
    });
  });
});
