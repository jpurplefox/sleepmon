import { describe, expect, it } from "vitest";

import { maxIngredientSlots } from "./constants";

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
