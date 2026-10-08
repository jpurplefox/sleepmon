import { MAX_FAVORITES, pickedFavorites, slotOne, toggleFavoriteSlot } from "./favoriteSlots";
import type { BerryRole, Island, ProductionInput, WeeklyBonus } from "./types";

export { MAX_FAVORITES };

/** Comparison's map terms (PRD 0002): one set for every card, never persisted. */
export interface ComparisonMap {
  /** Null is Normal: favorites double, no expert effects. */
  island: string | null;
  /** Positional slots ("" is open, see favoriteSlots); on an expert map slot 1 is the main. */
  favorites: string[];
  /** Kept while hidden on Normal. */
  weeklyBonus: WeeklyBonus;
}

export type MapRequestFields = Required<
  Pick<ProductionInput, "island" | "favorite_berries" | "main_favorite" | "weekly_bonus">
>;

export const NEUTRAL_MAP: ComparisonMap = {
  island: null,
  favorites: [],
  weeklyBonus: "berry_strength",
};

/** The maps Comparison offers besides Normal: the expert ones. */
export function comparisonIslands(islands: Island[]): Island[] {
  return islands.filter((i) => i.expert);
}

/** Switching maps keeps the favorites, slots and all. */
export function selectIsland(map: ComparisonMap, island: Island | null): ComparisonMap {
  return { ...map, island: island?.name ?? null };
}

/** The main favorite: slot 1, on an expert map only. */
export function mainOf(map: ComparisonMap, expert: boolean): string | null {
  return expert ? slotOne(map.favorites) : null;
}

export function toggleFavorite(map: ComparisonMap, berry: string): ComparisonMap {
  return { ...map, favorites: toggleFavoriteSlot(map.favorites, berry) };
}

export function berryRoleOf(map: ComparisonMap, expert: boolean, berry: string): BerryRole {
  if (berry === mainOf(map, expert)) return "main";
  return pickedFavorites(map.favorites).includes(berry) ? "sub" : "none";
}

export function mapRequestFields(map: ComparisonMap, expert: boolean): MapRequestFields {
  return {
    island: map.island,
    favorite_berries: pickedFavorites(map.favorites),
    main_favorite: mainOf(map, expert),
    weekly_bonus: expert ? map.weeklyBonus : null,
  };
}
