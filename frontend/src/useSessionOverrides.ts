import { useState } from "react";

import { useAuth } from "./auth/AuthContext";
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
 *
 * With no session nothing is ever "unsaved": there is no saved document to differ
 * from, and Player progress is reserved. The values still work — they are session
 * inputs — so Team Analysis stays usable anonymously, it just offers no save.
 */
export function useSessionOverrides(
  progress: PlayerProgress,
  selectedIsland: string | null,
): SessionOverrides {
  const { status } = useAuth();
  const canSave = status === "authenticated";

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

  const potUnsaved =
    canSave && isUnsaved(potOverride, progress.pot_size, DEFAULT_POT_SIZE);
  const areaBonusUnsaved =
    canSave &&
    selectedIsland !== null &&
    isUnsaved(
      bonusOverrides[selectedIsland],
      savedBonusPct,
      DEFAULT_AREA_BONUS,
    );
  const recipeLevelUnsaved = (name: string): boolean =>
    canSave &&
    isUnsaved(
      levelOverrides[name],
      progress.recipe_levels[name],
      DEFAULT_RECIPE_LEVEL,
    );

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
    setPotOverride,
    setAreaBonusOverride,
    setRecipeLevelOverride,
  };
}
