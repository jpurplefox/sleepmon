import type { BerryRole, Island, ProductionInput, WeeklyBonus } from "./types";

/** Comparison's map terms (PRD 0002): one set for every card, never persisted. */
export interface ComparisonMap {
  /** Null is Normal: favorites double, no expert effects. */
  island: string | null;
  /** In pick order, unique, at most three. */
  favorites: string[];
  /** The main favorite; null is a vacant slot, as in Team Analysis. */
  main: string | null;
  /** Kept while hidden on Normal. */
  weeklyBonus: WeeklyBonus;
}

export type MapRequestFields = Required<
  Pick<ProductionInput, "island" | "favorite_berries" | "main_favorite" | "weekly_bonus">
>;

export const MAX_FAVORITES = 3;

export const NEUTRAL_MAP: ComparisonMap = {
  island: null,
  favorites: [],
  main: null,
  weeklyBonus: "berry_strength",
};

/** The maps Comparison offers besides Normal: the expert ones. */
export function comparisonIslands(islands: Island[]): Island[] {
  return islands.filter((i) => i.expert);
}

export function selectIsland(map: ComparisonMap, island: Island | null): ComparisonMap {
  const main = island?.expert && map.main === null ? (map.favorites[0] ?? null) : map.main;
  return { ...map, island: island?.name ?? null, main };
}

export function toggleFavorite(map: ComparisonMap, berry: string): ComparisonMap {
  if (map.favorites.includes(berry)) {
    return {
      ...map,
      favorites: map.favorites.filter((b) => b !== berry),
      main: map.main === berry ? null : map.main,
    };
  }
  if (map.favorites.length >= MAX_FAVORITES) return map;
  return { ...map, favorites: [...map.favorites, berry], main: map.main ?? berry };
}

export function berryRoleOf(map: ComparisonMap, expert: boolean, berry: string): BerryRole {
  if (expert && berry === map.main) return "main";
  return map.favorites.includes(berry) ? "sub" : "none";
}

export function mapRequestFields(map: ComparisonMap, expert: boolean): MapRequestFields {
  return {
    island: map.island,
    favorite_berries: map.favorites,
    main_favorite: expert ? map.main : null,
    weekly_bonus: expert ? map.weeklyBonus : null,
  };
}
