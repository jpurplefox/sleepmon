import { describe, expect, it } from "vitest";

import { EVENT_KINDS, atBound, formatEffectValue, isComplete, stepValue, toRequest } from "./eventBonus";

describe("stepValue", () => {
  it("steps additive kinds by 1 within bounds", () => {
    expect(stepValue("extra_ingredients", 1, 1)).toBe(2);
    expect(stepValue("extra_ingredients", 5, 1)).toBe(5);
    expect(stepValue("extra_ingredients", 1, -1)).toBe(1);
    expect(stepValue("carry_limit", 49, 1)).toBe(50);
  });
  it("steps factors by 0.05 without float drift", () => {
    expect(stepValue("skill_trigger", 1.05, 1)).toBe(1.1);
    expect(stepValue("skill_trigger", 1.15, 1)).toBe(1.2);
    expect(stepValue("skill_trigger", 3, 1)).toBe(3);
    expect(stepValue("skill_trigger", 1.05, -1)).toBe(1.05);
  });
  it("reports bounds", () => {
    expect(atBound("skill_level", 5, 1)).toBe(true);
    expect(atBound("skill_level", 1, -1)).toBe(true);
    expect(atBound("dish_strength", 1.5, 1)).toBe(false);
  });
});

describe("formatEffectValue", () => {
  it("prints +N and ×X with the locale's decimal mark", () => {
    expect(formatEffectValue("extra_berries", 1, "es")).toBe("+1");
    expect(formatEffectValue("skill_trigger", 1.5, "es")).toBe("×1,5");
    expect(formatEffectValue("dish_strength", 1.25, "en")).toBe("×1.25");
    expect(formatEffectValue("pot_size", 2, "es")).toBe("×2");
  });
});

describe("kinds", () => {
  it("team-wide kinds take no scope", () => {
    expect(EVENT_KINDS.dish_strength.scoped).toBe(false);
    expect(EVENT_KINDS.pot_size.scoped).toBe(false);
    expect(EVENT_KINDS.skill_trigger.scoped).toBe(true);
  });
});

describe("isComplete / toRequest", () => {
  it("needs a type when scoped by type", () => {
    expect(isComplete({ kind: "skill_trigger", value: 1.5, scope: { kind: "type", type: null } })).toBe(false);
    expect(isComplete({ kind: "skill_trigger", value: 1.5, scope: { kind: "type", type: "Psychic" } })).toBe(true);
  });
  it("maps scopes to the API shape", () => {
    expect(
      toRequest([
        { id: "a", kind: "extra_ingredients", value: 1, scope: { kind: "specialty", specialty: "Ingredients" } },
        { id: "b", kind: "dish_strength", value: 1.25, scope: { kind: "team" } },
        { id: "c", kind: "skill_trigger", value: 1.5, scope: { kind: "type", type: "Psychic" } },
      ]),
    ).toEqual([
      { kind: "extra_ingredients", value: 1, scope: "specialty", target: "Ingredients" },
      { kind: "dish_strength", value: 1.25, scope: "team", target: null },
      { kind: "skill_trigger", value: 1.5, scope: "type", target: "Psychic" },
    ]);
  });
});
