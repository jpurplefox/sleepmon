import { describe, expect, it } from "vitest";

import {
  carryIngredients,
  devolvedSkillLevel,
  evolvedSkillLevel,
  ingredientsAfterChange,
  lineBase,
} from "./evolution";
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

  it("handles pool slots: keeps a repeated valid pick, else the slot's first option", () => {
    const mew: Species = {
      ...ivysaur,
      ingredient_slots: [
        ["Fancy Egg", "Large Leek"],
        ["Fancy Egg", "Large Leek"],
        ["Fancy Egg", "Large Leek", "Slowpoke Tail"],
      ],
    };
    expect(carryIngredients(["Large Leek", "Large Leek", "Slowpoke Tail"], mew)).toEqual([
      "Large Leek",
      "Large Leek",
      "Slowpoke Tail",
    ]);
    expect(carryIngredients(["Slowpoke Tail", "Fancy Egg", "Honey"], mew)).toEqual([
      "Fancy Egg",
      "Fancy Egg",
      "Fancy Egg",
    ]);
  });
});

// A line (Bulbasaur → Ivysaur → Venusaur) and an unrelated species with the same kit.
const bulbasaur: Species = { ...ivysaur, name: "Bulbasaur", evolutions: ["Ivysaur"], previous_stage: null };
const venusaur: Species = { ...ivysaur, name: "Venusaur", evolutions: [], previous_stage: "Ivysaur" };
const lookalike: Species = { ...ivysaur, name: "Lookalike", evolutions: [], previous_stage: null };
const catalog = [bulbasaur, ivysaur, venusaur, lookalike];

describe("lineBase", () => {
  it("follows the previous stages back to the base form", () => {
    expect(lineBase("Venusaur", catalog)).toBe("Bulbasaur");
    expect(lineBase("Bulbasaur", catalog)).toBe("Bulbasaur");
    expect(lineBase("Lookalike", catalog)).toBe("Lookalike");
  });
});

describe("ingredientsAfterChange", () => {
  const kit = ["Honey", "Snoozy Tomato", "Soft Potato"];
  const firstOptions = ["Honey", "Honey", "Honey"];

  it("keeps the kit within one evolution line", () => {
    expect(ingredientsAfterChange(kit, "Bulbasaur", venusaur, catalog)).toEqual(kit);
    expect(ingredientsAfterChange(kit, "Venusaur", ivysaur, catalog)).toEqual(kit);
  });

  it("resets to each slot's first option for another line, even with the same options", () => {
    expect(ingredientsAfterChange(kit, "Ivysaur", lookalike, catalog)).toEqual(firstOptions);
  });

  it("fills the first options when there was no species", () => {
    expect(ingredientsAfterChange([], null, ivysaur, catalog)).toEqual(firstOptions);
  });
});

