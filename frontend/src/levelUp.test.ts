import { describe, expect, it } from "vitest";

import { comparisonRows, levelUpGain, spanUnlocks } from "./levelUp";
import type { LevelUp, Member, MemberProduction } from "./types";

const prod = (over: Partial<MemberProduction> = {}): MemberProduction => ({
  berries: 30, berry_strength: 1000, ingredients: [], ingredients_total: 0, skill_triggers: 4,
  skill_ingredients: [], skill_ingredient_total: null, skill_energy: null,
  skill_cooking_ingredients: null, skill_strength: null, skill_self_energy: null,
  skill_dream_shards: null, skill_tasty_chance: null, skill_extra_helpful: null,
  skill_random_energy: null, skill_berry_amount: null, skill_berries_per_teammate: null,
  helps_per_day: 40, ...over,
});

const member = (over: Partial<Member> = {}): Member => ({
  id: "m", species: "Pikachu", level: 15, nature: "", ribbon: "", skill_level: 2,
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: ["Skill Trigger S", "Helping Speed M", "Inventory Up S", "Berry Finding S"],
  ...over,
} as Member);

const up = (then: MemberProduction, target = 25): LevelUp => ({
  target_level: target, candies: 129, dream_shards: 9987, at_target: then,
});

describe("spanUnlocks", () => {
  it("lists the one unlock of a short span", () => {
    expect(spanUnlocks(member(), 25)).toEqual([
      { level: 25, kind: "subSkill", subSkill: "Helping Speed M" },
    ]);
  });
  it("lists every unlock of a long span, in level order", () => {
    expect(spanUnlocks(member(), 60).map((u) => u.level)).toEqual([25, 30, 50, 60]);
    expect(spanUnlocks(member(), 60)[1]).toEqual({ level: 30, kind: "ingredient", ingredient: "Warming Ginger" });
  });
  it("marks an empty sub-skill slot as not recorded", () => {
    expect(spanUnlocks(member({ level: 42, sub_skills: ["A", "B"] }), 50)).toEqual([
      { level: 50, kind: "subSkill", subSkill: null },
    ]);
  });
});

describe("levelUpGain", () => {
  const now = prod({ ingredients: [{ ingredient: "Fancy Apple", amount: 3.4 }], ingredients_total: 3.4 });
  it("reads strength for a berry specialist", () => {
    const g = levelUpGain(member(), "Berries", "Charge Strength S", now, up(prod({ berry_strength: 1519 })));
    expect(g).toEqual({ kind: "strength", now: 1000, then: 1519 });
  });
  it("reads strength for a skill specialist whose skill gives strength", () => {
    const g = levelUpGain(member(), "Skills", "Charge Strength S", prod({ skill_strength: 500 }),
      up(prod({ skill_strength: 600 })));
    expect(g).toEqual({ kind: "strength", now: 1500, then: 1600 });
  });
  it("reads triggers for any other skill specialist", () => {
    const g = levelUpGain(member(), "Skills", "Energy for Everyone S", now, up(prod({ skill_triggers: 4.1 })));
    expect(g).toEqual({ kind: "triggers", now: 4, then: 4.1 });
  });
  it("reads the main ingredient for an ingredient specialist", () => {
    const then = prod({ ingredients: [{ ingredient: "Fancy Apple", amount: 3.9 }] });
    const g = levelUpGain(member({ level: 42 }), "Ingredients", "Ingredient Magnet S", now, up(then, 50));
    expect(g).toEqual({ kind: "ingredient", ingredient: "Fancy Apple", now: 3.4, then: 3.9 });
  });
  it("reads the new ingredient when the span unlocks one", () => {
    const then = prod({ ingredients: [
      { ingredient: "Fancy Apple", amount: 2.0 }, { ingredient: "Warming Ginger", amount: 1.8 } ] });
    const g = levelUpGain(member({ level: 25 }), "Ingredients", "Ingredient Magnet S", now, up(then, 30));
    expect(g).toEqual({ kind: "newIngredient", ingredient: "Warming Ginger", then: 1.8 });
  });
  it("does not read strength for an Ingredients specialist with a berry-role skill", () => {
    const then = prod({ ingredients: [{ ingredient: "Fancy Apple", amount: 3.9 }] });
    const g = levelUpGain(member({ level: 42 }), "Ingredients", "Charge Strength S", now, up(then, 50));
    expect(g).toEqual({ kind: "ingredient", ingredient: "Fancy Apple", now: 3.4, then: 3.9 });
  });
  it("reads the new ingredient for an Ingredients specialist with Charge Strength", () => {
    const then = prod({ ingredients: [
      { ingredient: "Fancy Apple", amount: 2.0 }, { ingredient: "Warming Ginger", amount: 1.8 } ] });
    const g = levelUpGain(member({ level: 25 }), "Ingredients", "Charge Strength S", now, up(then, 30));
    expect(g).toEqual({ kind: "newIngredient", ingredient: "Warming Ginger", then: 1.8 });
  });
  it("reads skill triggers for a Skills specialist whose skill magnets ingredients", () => {
    const then = prod({ skill_triggers: 5, ingredients: [{ ingredient: "Fancy Apple", amount: 3.9 }] });
    const g = levelUpGain(member({ level: 42 }), "Skills", "Ingredient Magnet S", now, up(then, 50));
    expect(g).toEqual({ kind: "triggers", now: now.skill_triggers, then: 5 });
  });
  it("reads the ingredient for a Skills specialist that draws ingredients", () => {
    const then = prod({ ingredients: [{ ingredient: "Fancy Apple", amount: 3.9 }] });
    const g = levelUpGain(member({ level: 42 }), "Skills", "Ingredient Draw S", now, up(then, 50));
    expect(g).toEqual({ kind: "ingredient", ingredient: "Fancy Apple", now: 3.4, then: 3.9 });
  });
  it("reads strength for an All specialist", () => {
    expect(levelUpGain(member(), "All", "Bad Dreams", now, up(prod())).kind).toBe("strength");
  });
});

describe("comparisonRows", () => {
  it("orders helps, strength, ingredients, triggers and marks new ingredients", () => {
    const now = prod({ ingredients: [{ ingredient: "Fancy Apple", amount: 3.4 }] });
    const then = prod({ helps_per_day: 44, ingredients: [
      { ingredient: "Fancy Apple", amount: 2 }, { ingredient: "Warming Ginger", amount: 1.8 } ] });
    expect(comparisonRows(now, then)).toEqual([
      { metric: "helps", now: 40, then: 44 },
      { metric: "strength", now: 1000, then: 1000 },
      { metric: "ingredient", ingredient: "Fancy Apple", now: 3.4, then: 2 },
      { metric: "ingredient", ingredient: "Warming Ginger", now: null, then: 1.8 },
      { metric: "triggers", now: 4, then: 4 },
    ]);
  });
});
