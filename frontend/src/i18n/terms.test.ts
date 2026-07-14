import { describe, expect, it } from "vitest";

import { tBerry, tMainSkill } from "./terms";

describe("tBerry", () => {
  it("returns the bare backend name in English", () => {
    expect(tBerry("Oran", "en")).toBe("Oran");
  });

  it("prefixes 'Baya' and translates the known name in Spanish", () => {
    expect(tBerry("Oran", "es")).toBe("Baya Aranja");
  });

  it("still prefixes 'Baya' when the name is unknown", () => {
    expect(tBerry("Xyz", "es")).toBe("Baya Xyz");
  });
});

describe("tMainSkill", () => {
  it("returns the name unchanged in English", () => {
    expect(tMainSkill("Charge Strength S (Random)", "en")).toBe(
      "Charge Strength S (Random)",
    );
  });

  it("translates the base name in Spanish", () => {
    expect(tMainSkill("Ingredient Magnet S", "es")).toBe("Imán Ingredientes S");
  });

  it("translates the base and the parenthesised variant separately", () => {
    expect(tMainSkill("Charge Strength S (Random)", "es")).toBe(
      "Carga Vigor S (Aleatorio)",
    );
  });

  it("falls back to the original when a base or variant is unknown", () => {
    expect(tMainSkill("Unknown Skill", "es")).toBe("Unknown Skill");
    expect(tMainSkill("Unknown Skill (Weird)", "es")).toBe("Unknown Skill (Weird)");
  });
});
