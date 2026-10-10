import { describe, expect, it } from "vitest";

import { EVENT_KINDS, SPECIALTY_ICON } from "./eventBonus";
import { NATURE_STATS, statIcon } from "./natures";
import { subSkillIcon } from "./subskills";

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
