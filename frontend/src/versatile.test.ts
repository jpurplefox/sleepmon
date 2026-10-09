import { describe, expect, it } from "vitest";

import { effectiveSkill } from "./versatile";

describe("effectiveSkill", () => {
  it("is the species' skill for everyone but Mew", () => {
    expect(effectiveSkill("Charge Strength S", undefined)).toBe("Charge Strength S");
  });

  it("is Mew's chosen skill", () => {
    expect(effectiveSkill("Versatile", "Berry Burst")).toBe("Berry Burst");
  });

  it("falls back to Metronome for a Mew without a choice", () => {
    expect(effectiveSkill("Versatile", "")).toBe("Metronome");
    expect(effectiveSkill("Versatile", null)).toBe("Metronome");
  });

  it("is undefined without a species", () => {
    expect(effectiveSkill(undefined, "Berry Burst")).toBeUndefined();
  });
});
