import { useState, type Dispatch, type SetStateAction } from "react";

import { mainOf, type ComparisonMap } from "../comparisonMap";
import { mapSummary } from "../mapSummary";
import type { Catalog } from "../types";
import { MapField } from "./MapField";
import { MapModal } from "./MapModal";

interface Props {
  catalog: Catalog;
  value: ComparisonMap;
  onChange: Dispatch<SetStateAction<ComparisonMap>>;
  /** Called when the map itself changes (for telemetry). */
  onSelectIsland?: (name: string) => void;
}

/**
 * Comparison's map terms with Team analysis's own Map field and dialog: map, favorite
 * berries and, on an expert map, the weekly bonus. Always a map, and no area bonus —
 * it multiplies every card alike, so it moves no delta.
 */
export function ComparisonMapBar({ catalog, value, onChange, onSelectIsland }: Props) {
  const [open, setOpen] = useState(false);
  const island = catalog.islands.find((i) => i.name === value.island) ?? null;
  const expert = island?.expert ?? false;
  const summary = mapSummary({
    island: value.island,
    berries: value.favorites,
    expert,
    areaBonusPct: 0,
    weeklyBonus: value.weeklyBonus,
  });

  return (
    <>
      <MapField
        map={summary}
        mapNames={catalog.islands.map((i) => i.name)}
        onOpen={() => setOpen(true)}
        allowNone={false}
        withArea={false}
      />
      {open && (
        <MapModal
          catalog={catalog}
          allowNone={false}
          selectedIsland={value.island}
          favoriteBerries={value.favorites}
          mainFavorite={mainOf(value, expert)}
          weeklyBonus={value.weeklyBonus}
          onSelectIsland={(name) => {
            // Comparison always has a map: the dialog offers no "No map".
            if (name === null || name === value.island) return;
            onSelectIsland?.(name);
            onChange((m) => ({ ...m, island: name }));
          }}
          // Slot 1 is the main (see comparisonMap): the dialog's own pick is the same berry.
          onFavoriteBerries={(favorites) => onChange((m) => ({ ...m, favorites }))}
          onMainFavorite={() => {}}
          onWeeklyBonus={(weeklyBonus) => onChange((m) => ({ ...m, weeklyBonus }))}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
