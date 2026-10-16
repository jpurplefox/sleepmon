import { INGREDIENT_UNLOCK_LEVELS, SUB_SKILL_UNLOCK_LEVELS } from "./constants";
import { combinedIngredientTotals, mainIngredient } from "./ingredientProduction";
import { contributesBerryRole, producesIngredients } from "./skills";
import type { LevelUp, Member, MemberProduction } from "./types";

// PRD 0021 — the Box's level-up cost, presented: which unlocks a span crosses, the
// gain that defines the Pokémon, and the now-vs-target rows. Pure; no game rule here
// beyond the Box coverage's role rule, which this reuses.

export type Unlock =
  | { level: number; kind: "subSkill"; subSkill: string | null }
  | { level: number; kind: "ingredient"; ingredient: string };

export function spanUnlocks(
  member: Pick<Member, "level" | "sub_skills" | "ingredients">,
  target: number,
): Unlock[] {
  const inSpan = (lv: number) => lv > member.level && lv <= target;
  const subSkills: Unlock[] = SUB_SKILL_UNLOCK_LEVELS.flatMap((lv, i) =>
    inSpan(lv) ? [{ level: lv, kind: "subSkill" as const, subSkill: member.sub_skills[i] ?? null }] : [],
  );
  const ingredients: Unlock[] = INGREDIENT_UNLOCK_LEVELS.flatMap((lv, i) =>
    inSpan(lv) && member.ingredients[i]
      ? [{ level: lv, kind: "ingredient" as const, ingredient: member.ingredients[i] }]
      : [],
  );
  return [...subSkills, ...ingredients].sort((a, b) => a.level - b.level);
}

export type Gain =
  | { kind: "strength"; now: number; then: number }
  | { kind: "ingredient"; ingredient: string; now: number; then: number }
  | { kind: "newIngredient"; ingredient: string; then: number }
  | { kind: "triggers"; now: number; then: number };

export const strengthOf = (p: MemberProduction) => p.berry_strength + (p.skill_strength ?? 0);

export function levelUpGain(
  member: Member,
  specialty: string | undefined,
  skill: string | undefined,
  now: MemberProduction,
  levelUp: LevelUp,
): Gain {
  const then = levelUp.at_target;
  if (specialty === "Berries" || specialty === "All" || contributesBerryRole(skill))
    return { kind: "strength", now: strengthOf(now), then: strengthOf(then) };
  if (specialty === "Ingredients" || producesIngredients(skill)) {
    const thenTotals = combinedIngredientTotals(then);
    const nowTotals = combinedIngredientTotals(now);
    const unlocked = spanUnlocks(member, levelUp.target_level)
      .flatMap((u) => (u.kind === "ingredient" && !nowTotals.has(u.ingredient) ? [u.ingredient] : []))
      .sort((a, b) => (thenTotals.get(b) ?? 0) - (thenTotals.get(a) ?? 0));
    if (unlocked.length > 0)
      return { kind: "newIngredient", ingredient: unlocked[0], then: thenTotals.get(unlocked[0]) ?? 0 };
    const main = mainIngredient(then);
    if (main) return { kind: "ingredient", ingredient: main, now: nowTotals.get(main) ?? 0, then: thenTotals.get(main) ?? 0 };
  }
  return { kind: "triggers", now: now.skill_triggers, then: then.skill_triggers };
}

export type ComparisonRow =
  | { metric: "helps" | "strength" | "triggers"; now: number; then: number }
  | { metric: "ingredient"; ingredient: string; now: number | null; then: number };

export function comparisonRows(now: MemberProduction, then: MemberProduction): ComparisonRow[] {
  const nowIng = combinedIngredientTotals(now);
  const thenIng = combinedIngredientTotals(then);
  const order = [...new Set([...nowIng.keys(), ...thenIng.keys()])];
  return [
    { metric: "helps", now: now.helps_per_day ?? 0, then: then.helps_per_day ?? 0 },
    { metric: "strength", now: strengthOf(now), then: strengthOf(then) },
    ...order.map((ingredient): ComparisonRow => ({
      metric: "ingredient", ingredient, now: nowIng.get(ingredient) ?? null, then: thenIng.get(ingredient) ?? 0,
    })),
    { metric: "triggers", now: now.skill_triggers, then: then.skill_triggers },
  ];
}
