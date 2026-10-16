import { describe, expect, it } from "vitest";

import { countsAs, roleOf, skillRole } from "./role";

describe("skillRole", () => {
  it("files strength and berry skills as Berries", () => {
    expect(skillRole("Charge Strength M")).toBe("Berries");
    expect(skillRole("Charge Strength S (Random)")).toBe("Berries");
    expect(skillRole("Berry Burst (Disguise)")).toBe("Berries");
  });
  it("files Ingredient Draw as Ingredients", () => {
    expect(skillRole("Ingredient Draw S (Hyper Cutter)")).toBe("Ingredients");
  });
  it("keeps Ingredient Magnet and everything else in Skills", () => {
    expect(skillRole("Ingredient Magnet S (Plus)")).toBe("Skills");
    expect(skillRole("Energy for Everyone S")).toBe("Skills");
    expect(skillRole(undefined)).toBe("Skills");
  });
});

describe("roleOf", () => {
  it.each([
    ["Noivern", "Skills", "Charge Strength M", "Berries"],
    ["Sceptile", "Skills", "Berry Burst", "Berries"],
    ["Crustle", "Skills", "Ingredient Draw S", "Ingredients"],
    ["Plusle", "Skills", "Ingredient Magnet S (Plus)", "Skills"],
    ["Delibird", "Ingredients", "Ingredient Magnet S (Present)", "Ingredients"],
    ["Golem", "Ingredients", "Charge Strength S (Random)", "Ingredients"],
    ["Wigglytuff", "Skills", "Energy for Everyone S", "Skills"],
    ["Darkrai", "All", "Charge Strength M (Bad Dreams)", "Berries"],
    ["Mew", "All", "Cooking Power-Up S", "Skills"],
  ])("%s → its role", (_name, specialty, skill, role) => {
    expect(roleOf(specialty, skill)).toBe(role);
  });
});

describe("countsAs", () => {
  it("counts a mythical as every role", () => {
    for (const role of ["Berries", "Ingredients", "Skills"] as const)
      expect(countsAs("All", "Cooking Power-Up S", role)).toBe(true);
  });
  it("counts everyone else only as their role", () => {
    expect(countsAs("Skills", "Ingredient Magnet S", "Ingredients")).toBe(false);
    expect(countsAs("Skills", "Ingredient Draw S", "Ingredients")).toBe(true);
    expect(countsAs("Ingredients", "Charge Strength S", "Berries")).toBe(false);
  });
});
