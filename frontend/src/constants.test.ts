import { describe, expect, it } from "vitest";

import { maxIngredientSlots, maxSubSkillSlots } from "./constants";

describe("maxIngredientSlots", () => {
  it("unlocks a slot at levels 1, 30 and 60", () => {
    expect(maxIngredientSlots(0)).toBe(0);
    expect(maxIngredientSlots(1)).toBe(1);
    expect(maxIngredientSlots(29)).toBe(1);
    expect(maxIngredientSlots(30)).toBe(2);
    expect(maxIngredientSlots(59)).toBe(2);
    expect(maxIngredientSlots(60)).toBe(3);
    expect(maxIngredientSlots(100)).toBe(3);
  });
});

describe("maxSubSkillSlots", () => {
  it("unlocks a slot at levels 10, 25, 50, 70 and 80", () => {
    expect(maxSubSkillSlots(9)).toBe(0);
    expect(maxSubSkillSlots(10)).toBe(1);
    expect(maxSubSkillSlots(25)).toBe(2);
    expect(maxSubSkillSlots(50)).toBe(3);
    expect(maxSubSkillSlots(70)).toBe(4);
    expect(maxSubSkillSlots(80)).toBe(5);
    expect(maxSubSkillSlots(100)).toBe(5);
  });
});
