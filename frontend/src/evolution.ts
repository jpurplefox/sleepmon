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
