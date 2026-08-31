import { useState } from "react";

import {
  DEFAULT_AREA_BONUS,
  DEFAULT_POT_SIZE,
  DEFAULT_RECIPE_LEVEL,
  areaBonusOf,
  effective,
  isUnsaved,
} from "./progress";
import type { PlayerProgress } from "./types";

export interface SessionOverrides {
  /** Override ?? saved ?? default. */
  potSize: number;
  /** Override ?? saved ?? default, for the currently selected island. In percentage points (0-85). */
  areaBonusPct: number;
  /** Override ?? saved ?? default for one recipe's level. */
  recipeLevelFor: (name: string) => number;
  /** True when the shown pot size differs from what is saved. */
  potUnsaved: boolean;
  /** True when the shown area bonus differs from what is saved. False with no island selected. */
  areaBonusUnsaved: boolean;
  /** True when the shown level for one recipe differs from what is saved. */
  recipeLevelUnsaved: (name: string) => boolean;
  /** Names of every recipe currently overridden away from its saved level —
   * used to ask before leaving (PRD 0011) and to save them all at once. */
  unsavedRecipeNames: string[];
  /** Pass undefined to clear the override and fall back to saved/default again. */
  setPotOverride: (value: number | undefined) => void;
  /** No-op with no island selected — there is nothing to key the override to. */
  setAreaBonusOverride: (pct: number) => void;
  setRecipeLevelOverride: (name: string, level: number) => void;
}

/**
 * Session-only edits (PRD 0011) layered over the saved `progress`: pot size, the
 * per-island area bonus, and per-recipe levels. Everything returned is DERIVED —
 * override ?? saved ?? default — never synced into state with an effect, so a
 * fresh `progress` (the query resolving mid-session) is reflected immediately for
 * anything not overridden, while overrides stay untouched.
 */
export function useSessionOverrides(
  progress: PlayerProgress,
  selectedIsland: string | null,
): SessionOverrides {
  const [potOverride, setPotOverride] = useState<number | undefined>(undefined);
  const [bonusOverrides, setBonusOverrides] = useState<Record<string, number>>(
    {},
  );
  const [levelOverrides, setLevelOverrides] = useState<Record<string, number>>(
    {},
  );

  const potSize = effective(potOverride, progress.pot_size, DEFAULT_POT_SIZE);

  // Keyed by the currently selected island, so one map's override never leaks onto another.
  const savedBonusPct = areaBonusOf(progress, selectedIsland);
  const areaBonusPct =
    selectedIsland === null
      ? DEFAULT_AREA_BONUS
      : effective(
          bonusOverrides[selectedIsland],
          savedBonusPct,
          DEFAULT_AREA_BONUS,
        );

  const recipeLevelFor = (name: string): number =>
    effective(
      levelOverrides[name],
      progress.recipe_levels[name],
      DEFAULT_RECIPE_LEVEL,
    );

  const potUnsaved = isUnsaved(
    potOverride,
    progress.pot_size,
    DEFAULT_POT_SIZE,
  );
  const areaBonusUnsaved =
    selectedIsland !== null &&
    isUnsaved(
      bonusOverrides[selectedIsland],
      savedBonusPct,
      DEFAULT_AREA_BONUS,
    );
  const recipeLevelUnsaved = (name: string): boolean =>
    isUnsaved(
      levelOverrides[name],
      progress.recipe_levels[name],
      DEFAULT_RECIPE_LEVEL,
    );

  // Only overridden recipes can possibly be unsaved, so scanning that (small)
  // map is enough — no need to walk every recipe in the catalogue.
  const unsavedRecipeNames =
    Object.keys(levelOverrides).filter(recipeLevelUnsaved);

  const setAreaBonusOverride = (pct: number): void => {
    if (selectedIsland === null) return;
    setBonusOverrides((prev) => ({ ...prev, [selectedIsland]: pct }));
  };

  const setRecipeLevelOverride = (name: string, level: number): void => {
    setLevelOverrides((prev) => ({ ...prev, [name]: level }));
  };

  return {
    potSize,
    areaBonusPct,
    recipeLevelFor,
    potUnsaved,
    areaBonusUnsaved,
    recipeLevelUnsaved,
    unsavedRecipeNames,
    setPotOverride,
    setAreaBonusOverride,
    setRecipeLevelOverride,
  };
}
