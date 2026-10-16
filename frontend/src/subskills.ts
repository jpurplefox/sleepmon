// Sub-skill icons, served from /public/subskill as one SVG per sub skill: the
// tier letter (S/M/L) is part of the icon, so Helping Speed S and M differ. The
// file name is the sub skill's name in kebab case ("Helping Speed S" →
// helping-speed-s.svg).
export function subSkillIcon(name: string): string {
  return `/subskill/${name.toLowerCase().replace(/\s+/g, "-")}.svg`;
}

// Sub skills a seed can raise, lowest tier first. Every other sub skill has no tiers.
const SEED_FAMILIES: readonly (readonly string[])[] = [
  ["Helping Speed S", "Helping Speed M"],
  ["Ingredient Finder S", "Ingredient Finder M"],
  ["Skill Trigger S", "Skill Trigger M"],
  ["Skill Level Up S", "Skill Level Up M"],
  ["Inventory Up S", "Inventory Up M", "Inventory Up L"],
];

export interface SeedResult {
  slots: string[];
  /** Sub skills raised: one seed each, however many tiers. 0 = nothing to seed. */
  seeds: number;
}

// Seeds every slot in unlock order: each tiered sub skill goes to the highest tier no
// other slot holds, never below its own. Empty slots ("") are kept in place.
export function seedSubSkills(slots: readonly string[]): SeedResult {
  const next = [...slots];
  let seeds = 0;
  next.forEach((name, i) => {
    const family = SEED_FAMILIES.find((f) => f.includes(name));
    if (!family) return;
    const own = family.indexOf(name);
    for (let tier = family.length - 1; tier > own; tier--) {
      if (!next.includes(family[tier])) {
        next[i] = family[tier];
        seeds += 1;
        return;
      }
    }
  });
  return { slots: next, seeds };
}

// Slots (0-based) whose sub skill differs between two lists; a missing slot counts as "".
export function changedSlots(before: readonly string[], after: readonly string[]): number[] {
  const length = Math.max(before.length, after.length);
  return Array.from({ length }, (_, i) => i).filter((i) => (before[i] ?? "") !== (after[i] ?? ""));
}
