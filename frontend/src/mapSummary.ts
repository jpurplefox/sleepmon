export interface MapSummary {
  /** Island name, or null when no map is selected. */
  name: string | null;
  /** Favorite berries in display order: on an expert map the main favorite first. */
  berries: string[];
  /** Area bonus in percentage points, or null when it is 0 (nothing to show). */
  areaPct: number | null;
}

/** What Team Analysis's Map field shows for the current map settings. */
export function mapSummary(args: {
  island: string | null;
  berries: string[];
  mainFavorite: string | null;
  expert: boolean;
  areaBonusPct: number;
}): MapSummary {
  if (args.island === null) return { name: null, berries: [], areaPct: null };
  const berries = [...new Set(args.berries.filter(Boolean))];
  const main = args.mainFavorite;
  if (args.expert && main && berries.includes(main)) {
    berries.splice(berries.indexOf(main), 1);
    berries.unshift(main);
  }
  const areaPct = args.areaBonusPct > 0 ? Math.round(args.areaBonusPct) : null;
  return { name: args.island, berries, areaPct };
}
