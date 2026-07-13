import { describe, expect, it } from "vitest";

import {
  combinedIngredientTotals,
  mainIngredient,
  totalIngredients,
} from "./ingredientProduction";
import type { MemberProduction, SlotProduction } from "./types";

function makeProd(overrides: Partial<MemberProduction> = {}): MemberProduction {
  return {
    berries: 0,
    berry_strength: 0,
    ingredients: [],
    ingredients_total: 0,
    skill_triggers: 0,
    skill_ingredients: [],
    skill_ingredient_total: null,
    skill_energy: null,
    skill_cooking_ingredients: null,
    skill_strength: null,
    skill_self_energy: null,
    skill_dream_shards: null,
    skill_tasty_chance: null,
    skill_extra_helpful: null,
    skill_random_energy: null,
    ...overrides,
  };
}

const slot = (ingredient: string, amount: number): SlotProduction => ({
  ingredient,
  amount,
});

describe("combinedIngredientTotals", () => {
  it("sums base and skill amounts per ingredient", () => {
    const totals = combinedIngredientTotals(
      makeProd({
        ingredients: [slot("apple", 5), slot("apple", 3), slot("milk", 2)],
        skill_ingredients: [slot("apple", 1)],
      }),
    );
    expect(totals.get("apple")).toBe(9);
    expect(totals.get("milk")).toBe(2);
  });

  it("ignores the random skill total (Ingredient Magnet)", () => {
    const totals = combinedIngredientTotals(
      makeProd({
        ingredients: [slot("apple", 4)],
        skill_ingredient_total: 100,
      }),
    );
    expect(totals.get("apple")).toBe(4);
    expect([...totals.keys()]).toEqual(["apple"]);
  });

  it("is empty when nothing specific is produced", () => {
    expect(combinedIngredientTotals(makeProd()).size).toBe(0);
  });
});

describe("mainIngredient", () => {
  it("picks the ingredient with the highest combined amount", () => {
    const prod = makeProd({
      ingredients: [slot("apple", 5), slot("milk", 2)],
      skill_ingredients: [slot("milk", 10)],
    });
    expect(mainIngredient(prod)).toBe("milk");
  });

  it("returns null when there is no specific ingredient", () => {
    expect(mainIngredient(makeProd({ skill_ingredient_total: 50 }))).toBeNull();
  });
});

describe("totalIngredients", () => {
  it("adds base, specific skill and random skill ingredients", () => {
    const prod = makeProd({
      ingredients_total: 10,
      skill_ingredients: [slot("apple", 3), slot("milk", 2)],
      skill_ingredient_total: 4,
    });
    expect(totalIngredients(prod)).toBe(19);
  });

  it("treats a missing random skill total as zero", () => {
    const prod = makeProd({
      ingredients_total: 10,
      skill_ingredients: [slot("apple", 3)],
      skill_ingredient_total: null,
    });
    expect(totalIngredients(prod)).toBe(13);
  });
});
