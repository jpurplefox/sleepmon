import { describe, expect, it } from "vitest";
import { expertMarks } from "./expertMarks";

const t = (key: string) => key;

const args = {
  role: "main" as const,
  expert: true,
  weeklyBonus: "berry_strength" as const,
  skillLevel: 3,
  effectiveSkillLevel: 4,
  t,
};

describe("expertMarks", () => {
  it("marks the berry doubling on a normal map and nothing else", () => {
    const marks = expertMarks({ ...args, expert: false, role: "sub", effectiveSkillLevel: 3 });
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ metric: "berries", label: "×2", tone: "good" });
  });

  it("marks nothing for a non-favorite berry on a normal map", () => {
    expect(
      expertMarks({ ...args, expert: false, role: "none", effectiveSkillLevel: 3 }),
    ).toEqual([]);
  });

  it("marks the main favorite with cadence, skill level and berry strength", () => {
    const marks = expertMarks(args);
    expect(marks.map((m) => m.metric).sort()).toEqual(["berries", "cadence", "skill"]);
    expect(marks.find((m) => m.metric === "cadence")?.label).toBe("−10%");
    expect(marks.find((m) => m.metric === "berries")?.label).toBe("×2,4");
  });

  it("omits the skill level mark when the Pokémon is already at its cap", () => {
    const marks = expertMarks({ ...args, effectiveSkillLevel: 3 });
    expect(marks.some((m) => m.label === "Skill +1")).toBe(false);
  });

  it("gives a sub-favorite only the weekly bonus", () => {
    const marks = expertMarks({ ...args, role: "sub", effectiveSkillLevel: 3 });
    expect(marks).toHaveLength(1);
    expect(marks[0].metric).toBe("berries");
  });

  it("marks the penalty in the bad tone on the cadence", () => {
    const marks = expertMarks({ ...args, role: "none", effectiveSkillLevel: 3 });
    expect(marks).toEqual([
      expect.objectContaining({ metric: "cadence", label: "+15%", tone: "bad" }),
    ]);
  });

  it("puts the ingredient bonus on the ingredients block, alongside the plain ×2", () => {
    const marks = expertMarks({
      ...args,
      role: "sub",
      weeklyBonus: "ingredient",
      effectiveSkillLevel: 3,
    });
    expect(marks).toEqual([
      expect.objectContaining({ metric: "berries", label: "×2", tone: "good" }),
      expect.objectContaining({ metric: "ingredients", label: "+1", tone: "good" }),
    ]);
  });

  it("puts the skill trigger bonus on the skill block, alongside the plain ×2", () => {
    const marks = expertMarks({
      ...args,
      role: "sub",
      weeklyBonus: "skill_trigger",
      effectiveSkillLevel: 3,
    });
    expect(marks).toEqual([
      expect.objectContaining({ metric: "berries", label: "×2", tone: "good" }),
      expect.objectContaining({ metric: "skill", label: "×1,25", tone: "good" }),
    ]);
  });

  it("gives a main favorite four marks with the ingredient weekly bonus", () => {
    const marks = expertMarks({ ...args, weeklyBonus: "ingredient" });
    expect(marks.map((m) => m.metric).sort()).toEqual([
      "berries",
      "cadence",
      "ingredients",
      "skill",
    ]);
    expect(marks.find((m) => m.metric === "cadence")?.label).toBe("−10%");
    expect(marks.find((m) => m.metric === "skill")?.label).toBe("Skill +1");
    expect(marks.find((m) => m.metric === "berries")?.label).toBe("×2");
    expect(marks.find((m) => m.metric === "ingredients")?.label).toBe("+1");
  });

  it("never exceeds four marks", () => {
    for (const weeklyBonus of ["berry_strength", "ingredient", "skill_trigger"] as const) {
      expect(expertMarks({ ...args, weeklyBonus }).length).toBeLessThanOrEqual(4);
    }
  });
});
