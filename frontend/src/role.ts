import { contributesBerryRole, drawsIngredients } from "./skills";

// PRD 0022 — what a Pokémon is for: one classification read by every feature.
export type Role = "Berries" | "Ingredients" | "Skills";

/** The role a main skill gives a Skills specialist (or a mythical, by its skill). */
export function skillRole(mainSkill: string | undefined): Role {
  if (contributesBerryRole(mainSkill)) return "Berries";
  if (drawsIngredients(mainSkill)) return "Ingredients";
  return "Skills";
}

/** The specialty wins; Skills specialists and mythicals go by their skill. */
export function roleOf(specialty: string | undefined, mainSkill: string | undefined): Role {
  if (specialty === "Berries" || specialty === "Ingredients") return specialty;
  return skillRole(mainSkill);
}

/** Box coverage and the level-up gain: mythicals keep counting as every role. */
export function countsAs(
  specialty: string | undefined,
  mainSkill: string | undefined,
  role: Role,
): boolean {
  return specialty === "All" || roleOf(specialty, mainSkill) === role;
}
