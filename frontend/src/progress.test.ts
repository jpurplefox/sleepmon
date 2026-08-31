import { describe, expect, it } from "vitest";

import {
  EMPTY_PROGRESS,
  areaBonusOf,
  effective,
  isUnsaved,
  potBounds,
  recipeLevelOf,
  stepPot,
} from "./progress";
import type { PlayerProgress } from "./types";

const LADDER = [21, 23, 25, 27, 29, 31, 33, 36, 39, 42];

const saved: PlayerProgress = {
  pot_size: 33,
  recipe_levels: { "Beanburger Curry": 55 },
  favorite_recipes: { Curry: "Beanburger Curry" },
  area_bonuses: { "Cyan Beach": 42 },
};

describe("effective", () => {
  it("prefers the override", () => {
    expect(effective(36, 33, 21)).toBe(36);
  });

  it("falls back to the saved value", () => {
    expect(effective(undefined, 33, 21)).toBe(33);
  });

  it("falls back to the default when nothing is saved", () => {
    expect(effective(undefined, undefined, 21)).toBe(21);
  });

  it("treats an override of 0 as a real value, not as absent", () => {
    expect(effective(0, 42, 0)).toBe(0);
  });
});

describe("isUnsaved", () => {
  it("is true when the override differs from the saved value", () => {
    expect(isUnsaved(36, 33, 21)).toBe(true);
  });

  it("is false with no override", () => {
    expect(isUnsaved(undefined, 33, 21)).toBe(false);
  });

  it("is false when the override equals the saved value", () => {
    expect(isUnsaved(33, 33, 21)).toBe(false);
  });

  it("is false when the override equals the default and nothing is saved", () => {
    expect(isUnsaved(21, undefined, 21)).toBe(false);
  });

  it("is true when the override differs from the default and nothing is saved", () => {
    expect(isUnsaved(23, undefined, 21)).toBe(true);
  });
});

describe("stepPot", () => {
  it("moves up one rung", () => {
    expect(stepPot(LADDER, 33, 1)).toBe(36);
  });

  it("moves down one rung", () => {
    expect(stepPot(LADDER, 33, -1)).toBe(31);
  });

  it("stops at the bottom", () => {
    expect(stepPot(LADDER, 21, -1)).toBe(21);
  });

  it("stops at the top", () => {
    expect(stepPot(LADDER, 42, 1)).toBe(42);
  });

  it("snaps a value that is not on the ladder to the nearest rung", () => {
    expect(stepPot(LADDER, 34, 1)).toBe(36);
    expect(stepPot(LADDER, 34, -1)).toBe(33);
  });

  it("returns the current value when the ladder has not loaded", () => {
    expect(stepPot([], 33, 1)).toBe(33);
  });
});

describe("potBounds", () => {
  it("flags the bottom rung", () => {
    expect(potBounds(LADDER, 21)).toEqual({ atMin: true, atMax: false });
  });

  it("flags the top rung", () => {
    expect(potBounds(LADDER, 42)).toEqual({ atMin: false, atMax: true });
  });

  it("flags neither in the middle", () => {
    expect(potBounds(LADDER, 33)).toEqual({ atMin: false, atMax: false });
  });

  it("flags both when the ladder has not loaded", () => {
    expect(potBounds([], 33)).toEqual({ atMin: true, atMax: true });
  });
});

describe("lookups", () => {
  it("reads a saved recipe level", () => {
    expect(recipeLevelOf(saved, "Beanburger Curry")).toBe(55);
  });

  it("defaults an unlevelled recipe to 1", () => {
    expect(recipeLevelOf(saved, "Fancy Apple Curry")).toBe(1);
  });

  it("reads a saved area bonus", () => {
    expect(areaBonusOf(saved, "Cyan Beach")).toBe(42);
  });

  it("defaults an area with no bonus to 0", () => {
    expect(areaBonusOf(saved, "Taupe Hollow")).toBe(0);
  });

  it("gives 0 for no area at all — with no map there is no area bonus", () => {
    expect(areaBonusOf(saved, null)).toBe(0);
  });

  it("reads the empty progress as all defaults", () => {
    expect(EMPTY_PROGRESS.pot_size).toBe(21);
    expect(recipeLevelOf(EMPTY_PROGRESS, "Beanburger Curry")).toBe(1);
    expect(areaBonusOf(EMPTY_PROGRESS, "Cyan Beach")).toBe(0);
  });
});
