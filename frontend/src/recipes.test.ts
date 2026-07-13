import { describe, expect, it } from "vitest";

import { recipeImage, recipeStrengthAtLevel } from "./recipes";

describe("recipeImage", () => {
  it("strips accents, punctuation and spaces into a lowercase slug", () => {
    expect(recipeImage("Clodsire Éclair")).toBe("/recipes/clodsireeclair.png");
    expect(recipeImage('"Overgrow" Avocado Gratin')).toBe(
      "/recipes/overgrowavocadogratin.png",
    );
  });
});

describe("recipeStrengthAtLevel", () => {
  const bonus = [1.0, 1.5, 2.0];

  it("applies the level bonus and rounds", () => {
    expect(recipeStrengthAtLevel(100, 1, bonus)).toBe(100);
    expect(recipeStrengthAtLevel(100, 2, bonus)).toBe(150);
    // 10 * 1.25 = 12.5 -> rounds to 13
    expect(recipeStrengthAtLevel(10, 2, [1.0, 1.25])).toBe(13);
  });

  it("clamps the level into [1, levelBonus.length]", () => {
    expect(recipeStrengthAtLevel(100, 0, bonus)).toBe(100);
    expect(recipeStrengthAtLevel(100, -5, bonus)).toBe(100);
    expect(recipeStrengthAtLevel(100, 99, bonus)).toBe(200);
  });
});
