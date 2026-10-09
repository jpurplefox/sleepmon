// Mew's "Versatile" main skill: each Mew carries one skill out of a fixed list.
export const VERSATILE = "Versatile";
export const DEFAULT_VERSATILE_SKILL = "Metronome";

/** The skill a member actually uses: Mew's chosen one (Metronome by default). */
export function effectiveSkill(
  mainSkill: string | undefined,
  versatileSkill: string | null | undefined,
): string | undefined {
  if (mainSkill !== VERSATILE) return mainSkill;
  return versatileSkill || DEFAULT_VERSATILE_SKILL;
}
