import { MAX_FAVORITES, pickedFavorites, slotOne, toggleFavoriteSlot } from "./favoriteSlots";
import type { BerryRole, Island, ProductionInput, WeeklyBonus } from "./types";

export { MAX_FAVORITES };

/** Comparison's map terms (PRD 0002): one set for every card, never persisted. */
export interface ComparisonMap {
  /** The map's name, normal or expert: favorites double on both, expert effects only on an expert one. */
  island: string;
  /** Positional slots ("" is open, see favoriteSlots); on an expert map slot 1 is the main. */
  favorites: string[];
  /** Kept while hidden on a normal map. */
  weeklyBonus: WeeklyBonus;
}

export type MapRequestFields = Required<
  Pick<ProductionInput, "island" | "favorite_berries" | "main_favorite" | "weekly_bonus">
>;

/** Where you pick the favorites yourself, without expert effects: the plainest terms. */
export const DEFAULT_ISLAND = "Greengrass Isle";

export const NEUTRAL_MAP: ComparisonMap = {
  island: DEFAULT_ISLAND,
  favorites: [],
  weeklyBonus: "berry_strength",
};

/** A map whose favorites the game sets (Cyan Beach, Taupe Hollow…): you can't pick them. */
export function fixedFavorites(island: Island | null): boolean {
  return island !== null && !island.user_picks && island.favorite_berries.length > 0;
}

/** A map with its own favorites sets them; otherwise switching keeps yours, slots and all. */
export function selectIsland(map: ComparisonMap, island: Island): ComparisonMap {
  const favorites = fixedFavorites(island) ? [...island.favorite_berries] : map.favorites;
  return { ...map, island: island.name, favorites };
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
