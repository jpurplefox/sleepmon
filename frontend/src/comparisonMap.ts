import { MAX_FAVORITES, pickedFavorites, slotOne } from "./favoriteSlots";
import type { BerryRole, ProductionInput, WeeklyBonus } from "./types";

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

/** The main favorite: slot 1, on an expert map only. */
export function mainOf(map: ComparisonMap, expert: boolean): string | null {
  return expert ? slotOne(map.favorites) : null;
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
