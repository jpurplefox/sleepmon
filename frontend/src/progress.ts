// Player progress helpers (PRD 0011). Values shown in Team Analysis are DERIVED —
// `override ?? saved ?? default` — never synced into state with an effect.
import type { PlayerProgress, ProgressPatch } from "./types";

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
export function effective<T>(
  override: T | undefined,
  saved: T | undefined,
  fallback: T,
): T {
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
export function stepPot(
  ladder: number[],
  current: number,
  dir: 1 | -1,
): number {
  if (ladder.length === 0) return current;
  if (dir === 1) {
    const next = ladder.find((step) => step > current);
    return next ?? ladder[ladder.length - 1];
  }
  const previous = [...ladder].reverse().find((step) => step < current);
  return previous ?? ladder[0];
}

/** Which stepper buttons are disabled. An unloaded ladder disables both. */
export function potBounds(
  ladder: number[],
  current: number,
): { atMin: boolean; atMax: boolean } {
  if (ladder.length === 0) return { atMin: true, atMax: true };
  return {
    atMin: current <= ladder[0],
    atMax: current >= ladder[ladder.length - 1],
  };
}

export function recipeLevelOf(
  progress: PlayerProgress,
  recipe: string,
): number {
  return progress.recipe_levels[recipe] ?? DEFAULT_RECIPE_LEVEL;
}

/** With no area — no map selected — there is no area bonus. */
export function areaBonusOf(
  progress: PlayerProgress,
  area: string | null,
): number {
  if (area === null) return DEFAULT_AREA_BONUS;
  return progress.area_bonuses[area] ?? DEFAULT_AREA_BONUS;
}

/**
 * Applies a sparse patch to a draft in memory, mirroring the server's own PATCH
 * semantics (see `ProgressPatch`): an absent field is untouched, and inside a
 * mapping a default value (recipe level 1, area bonus 0, favorite null) removes
 * the key rather than storing it — so the draft's shape always matches what a
 * fresh load from the server would look like.
 */
export function applyProgressPatch(
  prev: PlayerProgress,
  patch: ProgressPatch,
): PlayerProgress {
  const next: PlayerProgress = { ...prev };

  if (patch.pot_size !== undefined) next.pot_size = patch.pot_size;

  if (patch.recipe_levels) {
    const levels = { ...prev.recipe_levels };
    for (const [name, level] of Object.entries(patch.recipe_levels)) {
      if (level === DEFAULT_RECIPE_LEVEL) delete levels[name];
      else levels[name] = level;
    }
    next.recipe_levels = levels;
  }

  if (patch.favorite_recipes) {
    const favorites = { ...prev.favorite_recipes };
    for (const [type, name] of Object.entries(patch.favorite_recipes)) {
      if (name === null) delete favorites[type];
      else favorites[type] = name;
    }
    next.favorite_recipes = favorites;
  }

  if (patch.area_bonuses) {
    const bonuses = { ...prev.area_bonuses };
    for (const [area, pct] of Object.entries(patch.area_bonuses)) {
      if (pct === DEFAULT_AREA_BONUS) delete bonuses[area];
      else bonuses[area] = pct;
    }
    next.area_bonuses = bonuses;
  }

  return next;
}

/**
 * The sparse patch that turns `saved` into `draft` — only the fields, and only
 * the mapping keys, that actually differ. Used by Player progress's Guardar so
 * it writes exactly the pending changes, never the whole draft.
 */
export function diffProgress(
  saved: PlayerProgress,
  draft: PlayerProgress,
): ProgressPatch {
  const patch: ProgressPatch = {};

  if (draft.pot_size !== saved.pot_size) patch.pot_size = draft.pot_size;

  const recipeLevels: Record<string, number> = {};
  for (const name of new Set([
    ...Object.keys(saved.recipe_levels),
    ...Object.keys(draft.recipe_levels),
  ])) {
    const before = recipeLevelOf(saved, name);
    const after = recipeLevelOf(draft, name);
    if (before !== after) recipeLevels[name] = after;
  }
  if (Object.keys(recipeLevels).length > 0) patch.recipe_levels = recipeLevels;

  const favoriteRecipes: Record<string, string | null> = {};
  for (const type of new Set([
    ...Object.keys(saved.favorite_recipes),
    ...Object.keys(draft.favorite_recipes),
  ])) {
    const before = saved.favorite_recipes[type] ?? null;
    const after = draft.favorite_recipes[type] ?? null;
    if (before !== after) favoriteRecipes[type] = after;
  }
  if (Object.keys(favoriteRecipes).length > 0)
    patch.favorite_recipes = favoriteRecipes;

  const areaBonuses: Record<string, number> = {};
  for (const area of new Set([
    ...Object.keys(saved.area_bonuses),
    ...Object.keys(draft.area_bonuses),
  ])) {
    const before = areaBonusOf(saved, area);
    const after = areaBonusOf(draft, area);
    if (before !== after) areaBonuses[area] = after;
  }
  if (Object.keys(areaBonuses).length > 0) patch.area_bonuses = areaBonuses;

  return patch;
}
