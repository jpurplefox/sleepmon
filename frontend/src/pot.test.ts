import { describe, expect, it } from "vitest";

import { dailyPotCapacity, perMealPot } from "./pot";

describe("perMealPot", () => {
  it("adds the floored per-meal share of the skill extra without a ticket", () => {
    expect(perMealPot(69, 0, false)).toBe(69);
    // 7 / 3 = 2.33 -> floored to 2
    expect(perMealPot(69, 7, false)).toBe(71);
  });

  it("grows the pot 50% and rounds up per meal with the Good Camp Ticket", () => {
    // ceil(69 * 1.5) = ceil(103.5) = 104
    expect(perMealPot(69, 0, true)).toBe(104);
    // ceil((69 + 7/3) * 1.5) = ceil(107.0) = 107
    expect(perMealPot(69, 7, true)).toBe(107);
  });
});

describe("dailyPotCapacity", () => {
  it("adds the whole skill extra once per day without a ticket", () => {
    // 69 * 3 + 7 = 214
    expect(dailyPotCapacity(69, 7, false)).toBe(214);
  });

  it("is three times the per-meal pot with the ticket (rounding per meal)", () => {
    // perMealPot(69, 7, true) = 107 -> 321
    expect(dailyPotCapacity(69, 7, true)).toBe(321);
  });
});
