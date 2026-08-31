// Player progress helpers (PRD 0011). Values shown in Team Analysis are DERIVED —
// `override ?? saved ?? default` — never synced into state with an effect.
import type { PlayerProgress } from "./types";

export const DEFAULT_POT_SIZE = 21;
export const DEFAULT_RECIPE_LEVEL = 1;
export const DEFAULT_AREA_BONUS = 0;

/** What an account reads before anything is saved, and while the query is in flight. */
export const EMPTY_PROGRESS: PlayerProgress = {
  pot_size: DEFAULT_POT_SIZE,
  recipe_levels: {},
  favorite_recipes: {},
  area_bonuses: {},
};

/** The value to show: the session's override, else what is saved, else the default. */
export function effective<T>(override: T | undefined, saved: T | undefined, fallback: T): T {
  if (override !== undefined) return override;
  return saved !== undefined ? saved : fallback;
}

/**
 * Whether the shown value differs from what is saved. Compares VALUES, not presence,
 * so putting a value back where it was clears the mark.
 */
export function isUnsaved<T>(
  override: T | undefined,
  saved: T | undefined,
  fallback: T,
): boolean {
  if (override === undefined) return false;
  return override !== (saved !== undefined ? saved : fallback);
}

/** The next rung in `dir`, snapping a value that sits between rungs. Bounded. */
export function stepPot(ladder: number[], current: number, dir: 1 | -1): number {
  if (ladder.length === 0) return current;
  if (dir === 1) {
    const next = ladder.find((step) => step > current);
    return next ?? ladder[ladder.length - 1];
  }
  const previous = [...ladder].reverse().find((step) => step < current);
  return previous ?? ladder[0];
}

/** Which stepper buttons are disabled. An unloaded ladder disables both. */
export function potBounds(ladder: number[], current: number): { atMin: boolean; atMax: boolean } {
  if (ladder.length === 0) return { atMin: true, atMax: true };
  return { atMin: current <= ladder[0], atMax: current >= ladder[ladder.length - 1] };
}

export function recipeLevelOf(progress: PlayerProgress, recipe: string): number {
  return progress.recipe_levels[recipe] ?? DEFAULT_RECIPE_LEVEL;
}

/** With no area — no map selected — there is no area bonus. */
export function areaBonusOf(progress: PlayerProgress, area: string | null): number {
  if (area === null) return DEFAULT_AREA_BONUS;
  return progress.area_bonuses[area] ?? DEFAULT_AREA_BONUS;
}
