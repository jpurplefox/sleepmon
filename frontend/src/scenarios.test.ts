import { describe, expect, it } from "vitest";

import { expertMarks } from "./expertMarks";
import { SCENARIOS, scenarioCardProps, scenarioOption } from "./scenarios";

describe("scenarios", () => {
  it("lists the five scenarios in PRD order", () => {
    expect(SCENARIOS.map((s) => s.value)).toEqual([
      "none",
      "favorite",
      "expert_berry",
      "expert_ingredient",
      "expert_skill",
    ]);
  });

  it("marks every scenario but the neutral one", () => {
    expect(scenarioOption("none").mark).toBeNull();
    expect(scenarioOption("favorite").mark).toBe("×2");
    expect(scenarioOption("expert_berry").mark).toBe("×2,4");
    expect(scenarioOption("expert_ingredient").mark).toBe("+1");
    expect(scenarioOption("expert_skill").mark).toBe("×1,25");
  });

  it("leaves the card untouched with no scenario", () => {
    expect(scenarioCardProps("none")).toEqual({
      berryRole: "none",
      expert: false,
      weeklyBonus: "berry_strength",
    });
  });

  it("reads a favorite berry without the expert rules", () => {
    expect(scenarioCardProps("favorite")).toEqual({
      berryRole: "sub",
      expert: false,
      weeklyBonus: "berry_strength",
    });
  });

  it("maps each expert scenario to its weekly bonus", () => {
    expect(scenarioCardProps("expert_berry").weeklyBonus).toBe("berry_strength");
    expect(scenarioCardProps("expert_ingredient").weeklyBonus).toBe("ingredient");
    expect(scenarioCardProps("expert_skill").weeklyBonus).toBe("skill_trigger");
  });

  it("never reads a card as the main favorite", () => {
    // Only one berry can be the main favorite, so its perks (−10% cadence,
    // Skill +1) are not reproducible for a whole comparison.
    for (const { value } of SCENARIOS) {
      expect(scenarioCardProps(value).berryRole).not.toBe("main");
    }
  });

  it("turns the expert rules on only for the expert scenarios", () => {
    expect(SCENARIOS.filter((s) => scenarioCardProps(s.value).expert).map((s) => s.value)).toEqual([
      "expert_berry",
      "expert_ingredient",
      "expert_skill",
    ]);
  });

  it("matches the selector's mark to the mark expertMarks puts on the card", () => {
    // Ties scenarios.ts's own mark strings to expertMarks.ts's, so the two files
    // can't drift apart silently (each has its own tests, but neither reads the other's).
    const identity = (key: string) => key;
    for (const { value, mark } of SCENARIOS) {
      if (mark === null) continue;
      const { berryRole, expert, weeklyBonus } = scenarioCardProps(value);
      const labels = expertMarks({
        role: berryRole,
        expert,
        weeklyBonus,
        skillLevel: 3,
        effectiveSkillLevel: 3,
        t: identity,
      }).map((m) => m.label);
      expect(labels).toContain(mark);
    }
  });
});
