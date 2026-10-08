import type { WeeklyBonus } from "./types";

export interface MapSummary {
  /** Island name, or null when no map is selected. */
  name: string | null;
  /** Favorite slots in place ("" is open, see favoriteSlots); on an expert map slot 1 is the main. */
  berries: string[];
  /** Area bonus in percentage points, or null when it is 0 (nothing to show). */
  areaPct: number | null;
  /** The expert map's weekly bonus; null on a regular map or with no map. */
  weeklyBonus: WeeklyBonus | null;
}

/** What Team Analysis's Map field shows for the current map settings. */
export function mapSummary(args: {
  island: string | null;
  berries: string[];
  expert: boolean;
  areaBonusPct: number;
  weeklyBonus: WeeklyBonus;
}): MapSummary {
  if (args.island === null) return { name: null, berries: [], areaPct: null, weeklyBonus: null };
  const berries = [...args.berries];
  const areaPct = args.areaBonusPct > 0 ? Math.round(args.areaBonusPct) : null;
  return { name: args.island, berries, areaPct, weeklyBonus: args.expert ? args.weeklyBonus : null };
}
