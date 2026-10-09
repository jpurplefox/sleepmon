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
  unmodeledSkillKey,
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
    expect(maxSkillLevel("Dream Shard Magnet S (Aura Sphere)")).toBe(8);
    expect(maxSkillLevel("Versatile")).toBe(8);
    expect(maxSkillLevel("Berry Zone (Psystrike)")).toBe(6);
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

  it("returns null for skills we do not describe yet", () => {
    expect(skillDescription("Metronome", 3, "en")).toBeNull();
    expect(skillDescription("Some Unknown Skill", 3, "en")).toBeNull();
    expect(skillDescription(undefined, 3, "en")).toBeNull();
  });
});

describe("variants with their own tables", () => {
  it("uses each variant's own amount, not the base skill's", () => {
    expect(skillDescription("Energy for Everyone S (Lunar Blessing)", 1, "en")).toBe(
      "Restores 3 Energy to each Pokémon on your team, and gets 5 Berries plus 1 of each of the Berries other Pokémon on your team collect. More with more species sharing its Berry on the team.",
    );
    expect(skillDescription("Energizing Cheer S (Heal Pulse)", 6, "en")).toBe(
      "Restores 22 Energy to two random Pokémon on your team and instantly gets you ×4 the usual help from those Pokémon. More with Latios on the team.",
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

describe("skills with a second effect", () => {
  it("describes Aura Sphere's shards and strength", () => {
    expect(skillDescription("Dream Shard Magnet S (Aura Sphere)", 1, "en")).toBe(
      "Obtain 240 Dream Shards. Also increases Snorlax's Strength by 200.",
    );
  });

  it("describes Bulk Up's ingredients and Extra Tasty boost", () => {
    expect(skillDescription("Cooking Assist S (Bulk Up)", 7, "es")).toBe(
      "Te consigue 24 ingredientes al azar. Además aumenta la probabilidad de Plato riquísimo un 5% hasta que cocines un Plato riquísimo o cambies de zona.",
    );
  });

  it("describes Psystrike's strength and Berry Zone", () => {
    expect(skillDescription("Berry Zone (Psystrike)", 1, "en")).toBe(
      "Increases Snorlax's Strength by 1,408 and Mago Berry strength by 0.6%, up to 24%, until you change sites.",
    );
  });

  it("describes Bad Dreams' strength and energy drain", () => {
    expect(skillDescription("Charge Strength M (Bad Dreams)", 1, "en")).toBe(
      "Increases Snorlax's Strength by 2,640 and lowers the Energy of each non-Dark-type teammate by 12.",
    );
    expect(skillDescription("Charge Strength M (Bad Dreams)", 7, "es")).toBe(
      "Aumenta el Vigor de Snorlax en 18.515 y reduce en 12 la Energía de cada compañero que no sea de tipo Siniestro.",
    );
  });

  it("describes Stockpile with its average strength per trigger", () => {
    expect(skillDescription("Charge Strength S (Stockpile)", 1, "en")).toBe(
      "Chooses Stockpile or Spit Up. Spit Up gives Snorlax Strength based on what was stockpiled: about 600 per trigger on average.",
    );
  });
});

describe("Berry Juice", () => {
  it("mentions the juice on top of the team energy", () => {
    expect(skillDescription("Energy for Everyone S (Berry Juice)", 1, "en")).toBe(
      "Restores 5 Energy to each Pokémon on your team. Sometimes also gets a Berry Juice.",
    );
  });
});

describe("team help and energy skills", () => {
  it("describes Helper Boost and caps it at 6", () => {
    expect(skillDescription("Helper Boost", 6, "en")).toBe(
      "Instantly gets you ×5 the usual help from all Pokémon on your team. More with more species sharing its Berry on the team.",
    );
    expect(maxSkillLevel("Helper Boost")).toBe(6);
  });

  it("describes Moonlight's shared energy", () => {
    expect(skillDescription("Charge Energy S (Moonlight)", 1, "es")).toBe(
      "Restaura 12 de Energía al usuario. A veces restaura además 6,3 de Energía a otro Pokémon.",
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

describe("unmodeledSkillKey", () => {
  it("flags skills whose production isn't calculated", () => {
    expect(unmodeledSkillKey("Metronome")).toBe("card.unmodeledSkill");
    expect(unmodeledSkillKey("Skill Copy (Mimic)")).toBe("card.unmodeledSkill");
    expect(unmodeledSkillKey("Skill Copy (Transform)")).toBe("card.unmodeledSkill");
  });

  it("flags the part that isn't calculated of partly modeled skills", () => {
    expect(unmodeledSkillKey("Berry Zone (Psystrike)")).toBe("card.unmodeledBerryZone");
    expect(unmodeledSkillKey("Energizing Cheer S (Nuzzle)")).toBe("card.unmodeledNuzzle");
  });

  it("leaves modeled skills alone", () => {
    expect(unmodeledSkillKey("Charge Strength S (Stockpile)")).toBeNull();
    expect(unmodeledSkillKey("Energizing Cheer S")).toBeNull();
    expect(unmodeledSkillKey("Charge Strength M (Bad Dreams)")).toBeNull();
    expect(unmodeledSkillKey(undefined)).toBeNull();
  });
});
