import { describe, expect, it } from "vitest";

import {
  burstsBerries,
  chargeEnergyAmount,
  contributesBerryRole,
  cookingPowerUpAmount,
  drawsIngredients,
  energizingCheerAmount,
  energyForEveryoneAmount,
  extraHelpfulAmount,
  ingredientDrawAmount,
  ingredientMagnetAmount,
  magnetsDreamShards,
  maxSkillLevel,
  producesIngredients,
  skillDescription,
  tastyChanceAmount,
} from "./skills";

describe("main-skill predicates", () => {
  it("recognize a family by prefix, including passive variants", () => {
    expect(drawsIngredients("Ingredient Draw S")).toBe(true);
    expect(drawsIngredients("Ingredient Draw S (Super Luck)")).toBe(true);
    expect(drawsIngredients("Charge Strength S")).toBe(false);
    expect(drawsIngredients(undefined)).toBe(false);
  });

  it("producesIngredients covers both Draw and Magnet", () => {
    expect(producesIngredients("Ingredient Draw S")).toBe(true);
    expect(producesIngredients("Ingredient Magnet S")).toBe(true);
    expect(producesIngredients("Charge Strength S")).toBe(false);
  });

  it("contributesBerryRole covers Charge Strength and Berry Burst", () => {
    expect(contributesBerryRole("Charge Strength S")).toBe(true);
    expect(contributesBerryRole("Berry Burst")).toBe(true);
    expect(contributesBerryRole("Ingredient Draw S")).toBe(false);
    expect(contributesBerryRole(undefined)).toBe(false);
  });
});

describe("per-level amounts", () => {
  it("index the level and clamp to [1, table length]", () => {
    // 7-long tables clamp at MAX_SKILL_LEVEL (7).
    expect(ingredientDrawAmount(1)).toBe(5);
    expect(ingredientDrawAmount(7)).toBe(18);
    expect(ingredientDrawAmount(0)).toBe(5);
    expect(ingredientDrawAmount(99)).toBe(18);

    expect(ingredientMagnetAmount(1)).toBe(6);
    expect(ingredientMagnetAmount(7)).toBe(24);

    expect(cookingPowerUpAmount(1)).toBe(7);
    expect(cookingPowerUpAmount(7)).toBe(31);

    expect(extraHelpfulAmount(1)).toBe(6);
    expect(extraHelpfulAmount(7)).toBe(12);
  });

  it("clamp skills that top out below level 7 to their own length", () => {
    // E4E, Tasty Chance, Energizing Cheer, Charge Energy cap at 6.
    expect(energyForEveryoneAmount(6)).toBe(18);
    expect(energyForEveryoneAmount(7)).toBe(18);
    expect(tastyChanceAmount(6)).toBe(10);
    expect(tastyChanceAmount(7)).toBe(10);
    expect(energizingCheerAmount(6)).toBe(50);
    expect(energizingCheerAmount(7)).toBe(50);
    expect(chargeEnergyAmount(6)).toBe(43);
    expect(chargeEnergyAmount(7)).toBe(43);
  });
});

describe("maxSkillLevel", () => {
  it("caps the skills that stop early and defaults to 7", () => {
    expect(maxSkillLevel("Energy for Everyone S")).toBe(6);
    expect(maxSkillLevel("Charge Energy S")).toBe(6);
    expect(maxSkillLevel("Tasty Chance S")).toBe(6);
    expect(maxSkillLevel("Energizing Cheer S")).toBe(6);
    expect(maxSkillLevel("Dream Shard Magnet S")).toBe(8);
    expect(maxSkillLevel("Charge Strength S")).toBe(7);
    expect(maxSkillLevel(undefined)).toBe(7);
  });
});

describe("magnetsDreamShards", () => {
  it("matches the Dream Shard Magnet family", () => {
    expect(magnetsDreamShards("Dream Shard Magnet S")).toBe(true);
    expect(magnetsDreamShards("Dream Shard Magnet S (Random)")).toBe(true);
    expect(magnetsDreamShards("Ingredient Magnet S")).toBe(false);
  });
});

describe("skillDescription", () => {
  it("resolves the level amount into the English copy", () => {
    expect(skillDescription("Ingredient Draw S", 1, "en")).toBe(
      "Gets 5 of one type of ingredient chosen randomly from a specific selection of ingredients.",
    );
    expect(skillDescription("Charge Strength S", 1, "en")).toBe(
      "Increases Snorlax's Strength by 400.",
    );
  });

  it("matches more specific variants before the generic prefix", () => {
    // "Charge Strength M" must win over "Charge Strength S".
    expect(skillDescription("Charge Strength M", 1, "en")).toBe(
      "Increases Snorlax's Strength by 880.",
    );
    // "(Random)" is a range, not the fixed amount.
    expect(skillDescription("Charge Strength S (Random)", 1, "en")).toBe(
      "Increases Snorlax's Strength by 200 to 800 at random.",
    );
    // The Plus variant wins over plain Ingredient Magnet S.
    expect(skillDescription("Ingredient Magnet S (Plus)", 1, "en")).toBe(
      "Gets you 5 ingredients at random, plus 6 more with a Plus/Minus partner.",
    );
  });

  it("uses the locale-specific copy for the amount", () => {
    // The thousands separator depends on the runtime's ICU data, so tolerate
    // its presence/absence; what we assert is the per-locale prose and value.
    expect(skillDescription("Charge Strength M", 7, "es")).toMatch(
      /^Aumenta el Vigor de Snorlax en 6[.,]?858\.$/,
    );
    expect(skillDescription("Charge Strength M", 7, "en")).toMatch(
      /^Increases Snorlax's Strength by 6[.,]?858\.$/,
    );
  });

  it("returns null for skills we do not estimate yet", () => {
    expect(skillDescription("Charge Strength S (Stockpile)", 3, "en")).toBeNull();
    // Lucario's variant shares the prefix with the base skill, so it must be
    // discarded before the generic Dream Shard branch.
    expect(skillDescription("Dream Shard Magnet S (Aura Sphere)", 3, "en")).toBeNull();
    expect(skillDescription("Some Unknown Skill", 3, "en")).toBeNull();
    expect(skillDescription(undefined, 3, "en")).toBeNull();
  });
});

describe("variants with their own tables", () => {
  it("uses each variant's own amount, not the base skill's", () => {
    expect(skillDescription("Energy for Everyone S (Lunar Blessing)", 1, "en")).toBe(
      "Restores 3 Energy to each Pokémon on your team. Also gets some of each Berry your teammates collect.",
    );
    expect(skillDescription("Energizing Cheer S (Heal Pulse)", 6, "en")).toBe(
      "Restores 22 Energy to two random Pokémon on your team and instantly gets you ×4 the usual help from those Pokémon.",
    );
    expect(skillDescription("Energizing Cheer S (Nuzzle)", 1, "en")).toBe(
      "Restores 9 Energy to one random Pokémon on your team. If you're lucky, that Pokémon also gets a main skill activation bonus.",
    );
    expect(skillDescription("Ingredient Magnet S (Present)", 7, "en")).toBe(
      "Gets you 17 ingredients chosen at random. Sometimes also gets 4 candy for one Pokémon on your team.",
    );
  });

  it("describes the Ingredient Draw variants' second effect", () => {
    expect(skillDescription("Ingredient Draw S (Super Luck)", 1, "en")).toBe(
      "Gets 5 of one type of ingredient chosen randomly from a specific selection of ingredients. On rare occasions, gets a great number of Dream Shards instead.",
    );
    expect(skillDescription("Ingredient Draw S (Hyper Cutter)", 1, "es")).toBe(
      "Consigue 5 de un tipo de ingrediente elegido al azar de una selección concreta. A veces consigue 5 ingredientes más.",
    );
  });
});

describe("Berry Burst", () => {
  it("recognizes the family and caps it at level 6", () => {
    expect(burstsBerries("Berry Burst")).toBe(true);
    expect(burstsBerries("Berry Burst (Disguise)")).toBe(true);
    expect(burstsBerries("Charge Strength S")).toBe(false);
    expect(maxSkillLevel("Berry Burst")).toBe(6);
    expect(maxSkillLevel("Berry Burst (Draco Meteor)")).toBe(6);
  });

  it("describes each variant with the level's amounts", () => {
    expect(skillDescription("Berry Burst", 1, "es")).toBe(
      "Consigue 11 bayas, más 1 de cada una de las bayas que recolectan los demás Pokémon del equipo.",
    );
    expect(skillDescription("Berry Burst", 6, "en")).toBe(
      "Gets 30 Berries plus 5 of each of the Berries other Pokémon on your team collect.",
    );
    expect(skillDescription("Berry Burst (Disguise)", 1, "en")).toBe(
      "Gets 8 Berries plus 1 of each of the Berries other Pokémon on your team collect. Once a day, a Great Success triples it.",
    );
    expect(skillDescription("Berry Burst (Draco Meteor)", 1, "en")).toBe(
      "Gets 12 Berries plus 1 of each of the Berries other Pokémon on your team collect. More with more Dragon species and with Latias on the team.",
    );
  });
});
