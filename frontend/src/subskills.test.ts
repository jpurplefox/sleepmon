import { describe, expect, it } from "vitest";

import { EVENT_KINDS, SPECIALTY_ICON } from "./eventBonus";
import { NATURE_STATS, statIcon } from "./natures";
import { seedSubSkills, subSkillIcon } from "./subskills";

// Every icon file under /public, as the URL the app serves it at.
const PUBLIC_FILES = new Set(
  Object.keys(import.meta.glob("../public/{nature,subskill,skill}/*")).map((p) => p.replace("../public", "")),
);
for (const f of Object.keys(import.meta.glob("../public/*.{png,webp}"))) PUBLIC_FILES.add(f.replace("../public", ""));
const served = (url: string) => PUBLIC_FILES.has(url);

// The backend's closed SubSkill enum (catalog_data.SUB_SKILL_TIERS).
const SUB_SKILLS = [
  "Sleep EXP Bonus",
  "Skill Level Up M",
  "Research EXP Bonus",
  "Helping Bonus",
  "Energy Recovery Bonus",
  "Dream Shard Bonus",
  "Berry Finding S",
  "Skill Trigger M",
  "Skill Level Up S",
  "Ingredient Finder M",
  "Helping Speed M",
  "Inventory Up M",
  "Inventory Up L",
  "Skill Trigger S",
  "Inventory Up S",
  "Ingredient Finder S",
  "Helping Speed S",
];

describe("subSkillIcon", () => {
  it("names the file after the sub skill, tier letter included", () => {
    expect(subSkillIcon("Helping Speed S")).toBe("/subskill/helping-speed-s.svg");
    expect(subSkillIcon("Helping Speed M")).toBe("/subskill/helping-speed-m.svg");
  });

  it.each(SUB_SKILLS)("serves an icon for %s", (name) => {
    expect(served(subSkillIcon(name))).toBe(true);
  });
});

describe("icon files", () => {
  it("serves the sub skill seed sprite", () => {
    expect(served("/sub-skill-seed.png")).toBe(true);
  });

  it.each(Object.keys(NATURE_STATS))("serves the nature stat icon for %s", (stat) => {
    expect(served(statIcon(stat))).toBe(true);
  });

  it.each(Object.entries(EVENT_KINDS))("serves the event icon for %s", (_, spec) => {
    expect(served(spec.icon)).toBe(true);
  });

  it.each(Object.entries(SPECIALTY_ICON))("serves the specialty icon for %s", (_, icon) => {
    expect(served(icon)).toBe(true);
  });
});

describe("seedSubSkills", () => {
  it("raises each tiered sub skill to its family's top tier", () => {
    expect(seedSubSkills(["Helping Speed S", "Skill Trigger S", "Inventory Up S"]).slots).toEqual([
      "Helping Speed M",
      "Skill Trigger M",
      "Inventory Up L",
    ]);
  });

  it("gives the top tier to the earliest slot", () => {
    expect(seedSubSkills(["Inventory Up S", "Inventory Up M"]).slots).toEqual([
      "Inventory Up L",
      "Inventory Up M",
    ]);
  });

  it("goes to the next free tier when the top one is taken", () => {
    expect(seedSubSkills(["Inventory Up L", "Inventory Up S"]).slots).toEqual([
      "Inventory Up L",
      "Inventory Up M",
    ]);
  });

  it("stays when every higher tier is taken, even by a later slot", () => {
    expect(seedSubSkills(["Helping Speed S", "Helping Speed M"]).slots).toEqual([
      "Helping Speed S",
      "Helping Speed M",
    ]);
    expect(seedSubSkills(["Inventory Up M", "Inventory Up L"]).slots).toEqual([
      "Inventory Up M",
      "Inventory Up L",
    ]);
  });

  it("leaves untiered sub skills and empty slots as they are", () => {
    expect(
      seedSubSkills(["Berry Finding S", "", "Helping Bonus", "Ingredient Finder S"]).slots,
    ).toEqual(["Berry Finding S", "", "Helping Bonus", "Ingredient Finder M"]);
  });

  it("does not change the slots it is given", () => {
    const slots = ["Skill Level Up S"];
    seedSubSkills(slots);
    expect(slots).toEqual(["Skill Level Up S"]);
  });

  it("counts one seed per tier raised", () => {
    expect(seedSubSkills(["Inventory Up S", "Inventory Up M", "Skill Trigger S"]).seeds).toBe(3);
    expect(seedSubSkills(["Inventory Up L", "Inventory Up S"]).seeds).toBe(1);
  });

  it("counts no seeds when everything is at its top free tier", () => {
    expect(seedSubSkills(["Inventory Up L", "Inventory Up M", "Skill Trigger M"]).seeds).toBe(0);
    expect(seedSubSkills([]).seeds).toBe(0);
  });
});
