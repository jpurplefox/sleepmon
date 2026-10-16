import { combinedIngredientTotals } from "./ingredientProduction";
import { strengthOf } from "./levelUp";
import { roleOf, type Role } from "./role";
import type { Member, MemberProduction, Species } from "./types";
import { effectiveSkill } from "./versatile";

// PRD 0002 § Suggestions — Box Pokémon comparable to the comparison's base.
export const MAX_SUGGESTIONS = 3;

/** What a Pokémon is compared by. */
export interface Comparable {
  role: Role;
  berry: string;
  mainIngredientAt60: string | null;
  skillFamily: string;
}

/** A skill's family: its name without a trailing "(Variant)". */
export function skillFamily(mainSkill: string | undefined): string {
  return (mainSkill ?? "").replace(/\s*\([^)]*\)$/, "");
}

export function comparableOf(
  species: Species,
  versatileSkill: string | null | undefined,
  mainIngredientAt60: string | null | undefined,
): Comparable {
  const skill = effectiveSkill(species.main_skill, versatileSkill);
  return {
    role: roleOf(species.specialty, skill),
    berry: species.berry,
    mainIngredientAt60: mainIngredientAt60 ?? null,
    skillFamily: skillFamily(skill),
  };
}

export function isComparable(base: Comparable, other: Comparable): boolean {
  if (base.role !== other.role) return false;
  if (base.role === "Berries") return base.berry === other.berry;
  if (base.role === "Ingredients")
    return base.mainIngredientAt60 !== null && base.mainIngredientAt60 === other.mainIngredientAt60;
  return base.skillFamily !== "" && base.skillFamily === other.skillFamily;
}

/** The metric that orders a role, at the Pokémon's own level; 0 without production. */
export function suggestionMetric(base: Comparable, production: MemberProduction | null | undefined): number {
  if (!production) return 0;
  if (base.role === "Berries") return strengthOf(production);
  if (base.role === "Ingredients")
    return combinedIngredientTotals(production).get(base.mainIngredientAt60 ?? "") ?? 0;
  return production.skill_triggers;
}

export function suggestComparables(
  base: Comparable,
  box: readonly Member[],
  comparableOfMember: (m: Member) => Comparable | null,
  dexOf: (species: string) => number,
  excludeIds: ReadonlySet<string>,
  limit = MAX_SUGGESTIONS,
): Member[] {
  return box
    .filter((m) => {
      if (excludeIds.has(m.id)) return false;
      const c = comparableOfMember(m);
      return c !== null && isComparable(base, c);
    })
    .map((m) => ({ m, metric: suggestionMetric(base, m.production), dex: dexOf(m.species) }))
    .sort((a, b) => b.metric - a.metric || a.dex - b.dex)
    .slice(0, limit)
    .map(({ m }) => m);
}
