import { maxSkillLevel } from "./skills";
import type { Species } from "./types";

// Each stage moves the main skill one level, as evolving does in the game.

/** Skill level after evolving one stage: +1, capped at the target species' skill max. */
export function evolvedSkillLevel(level: number, targetMainSkill: string | undefined): number {
  return Math.min(level + 1, maxSkillLevel(targetMainSkill));
}

/** Skill level after going back one stage: −1, never below 1. */
export function devolvedSkillLevel(level: number): number {
  return Math.max(1, level - 1);
}

/** Keeps each slot's ingredient when `species` offers it there; else the slot's first option. */
export function carryIngredients(previous: string[], species: Species): string[] {
  return species.ingredient_slots.map((opts, i) => {
    const prev = previous[i] ?? "";
    return opts.includes(prev) ? prev : (opts[0] ?? "");
  });
}

/** The base form of `name`'s evolution line, following `previous_stage` back. */
export function lineBase(name: string, catalog: Species[]): string {
  let base = name;
  // A line has at most three stages; the bound also guards a malformed catalog.
  for (let i = 0; i < 3; i++) {
    const previous = catalog.find((s) => s.name === base)?.previous_stage;
    if (!previous) break;
    base = previous;
  }
  return base;
}

/** The kit after a species change: kept within one evolution line, else each slot's first option. */
export function ingredientsAfterChange(
  previous: string[],
  from: string | null,
  to: Species,
  catalog: Species[],
): string[] {
  const sameLine = from !== null && lineBase(from, catalog) === lineBase(to.name, catalog);
  return carryIngredients(sameLine ? previous : [], to);
}
