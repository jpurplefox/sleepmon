import { describe, expect, it } from "vitest";

import { carryIngredients, devolvedSkillLevel, evolvedSkillLevel } from "./evolution";
import type { Species } from "./types";

const ivysaur: Species = {
  name: "Ivysaur",
  dex: 2,
  specialty: "Ingredients",
  berry: "Durin Berry",
  type: "Grass",
  sleep_type: "Dozing",
  main_skill: "Ingredient Magnet S",
  ingredient_slots: [["Honey"], ["Honey", "Snoozy Tomato"], ["Honey", "Snoozy Tomato", "Soft Potato"]],
  ingredient_amounts: [[2], [5, 4], [7, 7, 6]],
  base_inventory: 14,
  evolutions: ["Venusaur"],
  previous_stage: "Bulbasaur",
};

describe("evolvedSkillLevel", () => {
  it("raises the skill one level", () => {
    expect(evolvedSkillLevel(2, "Ingredient Magnet S")).toBe(3);
  });

  it("stops at the target skill's max", () => {
    expect(evolvedSkillLevel(7, "Ingredient Magnet S")).toBe(7);
    expect(evolvedSkillLevel(6, "Energy for Everyone S")).toBe(6);
  });
});

describe("devolvedSkillLevel", () => {
  it("lowers the skill one level, never below 1", () => {
    expect(devolvedSkillLevel(3)).toBe(2);
    expect(devolvedSkillLevel(1)).toBe(1);
  });
});

describe("carryIngredients", () => {
  it("keeps each ingredient the species offers in that slot", () => {
    const kit = ["Honey", "Snoozy Tomato", "Soft Potato"];
    expect(carryIngredients(kit, ivysaur)).toEqual(kit);
  });

  it("falls back to the slot's first option otherwise", () => {
    expect(carryIngredients(["Fancy Apple", "Honey", "Fancy Egg"], ivysaur)).toEqual([
      "Honey",
      "Honey",
      "Honey",
    ]);
    expect(carryIngredients([], ivysaur)).toEqual(["Honey", "Honey", "Honey"]);
  });
});
