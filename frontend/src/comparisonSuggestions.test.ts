import { describe, expect, it } from "vitest";

import {
  comparableOf,
  isComparable,
  skillFamily,
  suggestComparables,
  type Comparable,
} from "./comparisonSuggestions";
import type { Member, MemberProduction, Species } from "./types";

const species = (name: string, dex: number, specialty: string, berry: string, main_skill: string) =>
  ({ name, dex, specialty, berry, main_skill } as Species);

const CATALOG: Record<string, Species> = {
  Noivern: species("Noivern", 715, "Skills", "Yache", "Charge Strength M"),
  Salamence: species("Salamence", 373, "Berries", "Yache", "Charge Strength M"),
  Altaria: species("Altaria", 334, "Berries", "Yache", "Charge Energy S"),
  Shelgon: species("Shelgon", 372, "Berries", "Yache", "Charge Strength M"),
  Bagon: species("Bagon", 371, "Berries", "Yache", "Charge Strength M"),
  Dragonite: species("Dragonite", 149, "Ingredients", "Yache", "Charge Energy S"),
  Sceptile: species("Sceptile", 254, "Skills", "Durin", "Berry Burst"),
  Golem: species("Golem", 76, "Ingredients", "Sitrus", "Charge Strength S (Random)"),
  Crustle: species("Crustle", 558, "Skills", "Lum", "Ingredient Draw S"),
  Bulbasaur: species("Bulbasaur", 1, "Ingredients", "Durin", "Ingredient Magnet S"),
  Plusle: species("Plusle", 311, "Skills", "Grepa", "Ingredient Magnet S (Plus)"),
  Minun: species("Minun", 312, "Skills", "Grepa", "Cooking Power-Up S (Minus)"),
  Charmander: species("Charmander", 4, "Skills", "Leppa", "Cooking Power-Up S"),
  Wigglytuff: species("Wigglytuff", 40, "Skills", "Pecha", "Energy for Everyone S"),
  Darkrai: species("Darkrai", 491, "All", "Wiki", "Charge Strength M (Bad Dreams)"),
  Mew: species("Mew", 151, "All", "Mago", "Versatile"),
};

const prod = (over: Partial<MemberProduction> = {}): MemberProduction => ({
  berries: 0, berry_strength: 0, ingredients: [], ingredients_total: 0, skill_triggers: 0,
  skill_ingredients: [], skill_ingredient_total: null, skill_energy: null,
  skill_cooking_ingredients: null, skill_strength: null, skill_self_energy: null,
  skill_dream_shards: null, skill_tasty_chance: null, skill_extra_helpful: null,
  skill_random_energy: null, skill_berry_amount: null, skill_berries_per_teammate: null,
  ...over,
});

const member = (id: string, name: string, production: Partial<MemberProduction> = {}, over: Partial<Member> = {}) =>
  ({ id, species: name, level: 30, nature: "", ingredients: [], sub_skills: [], ribbon: "",
     skill_level: 1, production: prod(production), ...over } as Member);

const comparableOfMember = (m: Member): Comparable | null =>
  CATALOG[m.species]
    ? comparableOf(CATALOG[m.species], m.versatile_skill, m.production?.main_ingredient_at_60)
    : null;
const dexOf = (name: string) => CATALOG[name]?.dex ?? 0;
const base = (name: string, main60: string | null = null, versatile?: string) =>
  comparableOf(CATALOG[name], versatile, main60);
const suggest = (b: Comparable, box: Member[], exclude: string[] = []) =>
  suggestComparables(b, box, comparableOfMember, dexOf, new Set(exclude)).map((m) => m.id);

describe("skillFamily", () => {
  it("drops the variant", () => {
    expect(skillFamily("Cooking Power-Up S (Minus)")).toBe("Cooking Power-Up S");
    expect(skillFamily("Energy for Everyone S")).toBe("Energy for Everyone S");
    expect(skillFamily(undefined)).toBe("");
  });
});

describe("comparableOf", () => {
  it("files a mythical by its skill", () => {
    expect(base("Darkrai").role).toBe("Berries");
    expect(base("Mew", null, "Cooking Power-Up S").role).toBe("Skills");
    expect(base("Mew", "Honey", "Ingredient Draw S").role).toBe("Ingredients");
  });
});

describe("suggestComparables", () => {
  it("Berries: same role and berry only", () => {
    const box = [
      member("sal", "Salamence"), member("dra", "Dragonite"),
      member("sce", "Sceptile"), member("gol", "Golem"),
    ];
    expect(suggest(base("Noivern"), box)).toEqual(["sal"]);
  });

  it("is symmetric between a strength skill and a Berries specialist", () => {
    expect(suggest(base("Salamence"), [member("noi", "Noivern")])).toEqual(["noi"]);
  });

  it("Ingredients: same main ingredient at level 60, Magnet left out", () => {
    const box = [
      member("bul", "Bulbasaur", { main_ingredient_at_60: "Glossy Avocado" }),
      member("dra", "Dragonite", { main_ingredient_at_60: "Fiery Herb" }),
      member("plu", "Plusle", { main_ingredient_at_60: "Glossy Avocado" }),
    ];
    expect(suggest(base("Crustle", "Glossy Avocado"), box)).toEqual(["bul"]);
  });

  it("Ingredients: matches by level 60 even when another ingredient leads today", () => {
    const low = member("bul", "Bulbasaur",
      { main_ingredient_at_60: "Glossy Avocado", ingredients: [{ ingredient: "Honey", amount: 9 }] },
      { level: 20 });
    expect(suggest(base("Crustle", "Glossy Avocado"), [low])).toEqual(["bul"]);
  });

  it("Ingredients: no match when the base has no main ingredient", () => {
    const box = [member("bul", "Bulbasaur", { main_ingredient_at_60: null })];
    expect(suggest(base("Crustle", null), box)).toEqual([]);
  });

  it("Skills: same skill family only", () => {
    const box = [member("cha", "Charmander"), member("wig", "Wigglytuff")];
    expect(suggest(base("Minun"), box)).toEqual(["cha"]);
  });

  it("keeps the 3 strongest, strongest first, ties by Pokédex", () => {
    const box = [
      member("bag", "Bagon", { berry_strength: 1000 }),
      member("alt", "Altaria", { berry_strength: 5000 }),
      member("she", "Shelgon", { berry_strength: 3000, skill_strength: 1000 }),
      member("sal", "Salamence", { berry_strength: 4000 }),
    ];
    // Shelgon and Salamence tie at 4000; Pokédex breaks it.
    expect(suggest(base("Noivern"), box)).toEqual(["alt", "she", "sal"]);
    // Adding the first one brings in the fourth.
    expect(suggest(base("Noivern"), box, ["alt"])).toEqual(["she", "sal", "bag"]);
  });

  it("orders Ingredients by the base's main ingredient per day", () => {
    const box = [
      member("a", "Bulbasaur", { main_ingredient_at_60: "Honey", ingredients: [{ ingredient: "Honey", amount: 2 }] }),
      member("b", "Bulbasaur", { main_ingredient_at_60: "Honey", ingredients: [{ ingredient: "Honey", amount: 5 }] }),
    ];
    expect(suggest(base("Crustle", "Honey"), box)).toEqual(["b", "a"]);
  });

  it("orders Skills by triggers per day", () => {
    const box = [
      member("a", "Charmander", { skill_triggers: 3 }),
      member("b", "Charmander", { skill_triggers: 6 }),
    ];
    expect(suggest(base("Minun"), box)).toEqual(["b", "a"]);
  });

  it("excludes Box Pokémon already in the comparison", () => {
    expect(suggest(base("Noivern"), [member("sal", "Salamence")], ["sal"])).toEqual([]);
  });

  it("skips species outside the catalog", () => {
    expect(suggest(base("Noivern"), [member("x", "Missingno")])).toEqual([]);
  });
});

describe("isComparable", () => {
  it("needs the same role", () => {
    expect(isComparable(base("Noivern"), base("Dragonite"))).toBe(false);
  });
});
