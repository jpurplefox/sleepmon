// Comparison's level (PRD 0002): the raise itself is the backend's; these only read it.
import type { RosterEntry } from "./roster";
import type { MemberInput, Production } from "./types";

export const COMPARISON_LEVELS = [10, 25, 30, 50, 60, 70] as const;
export type ComparisonLevel = (typeof COMPARISON_LEVELS)[number];

/** The level a card is shown and unlocked at: the raise's target, else its own. */
export function shownLevel(config: MemberInput, production: Production | null | undefined): number {
  return production?.comparison_raise?.to_level ?? config.level;
}

/** The cards as a share should carry them: each raised card at its target level. */
export function bakeRaisedLevels(
  entries: RosterEntry[],
  productions: readonly (Production | null | undefined)[],
): RosterEntry[] {
  return entries.map((e, i) => {
    const to = productions[i]?.comparison_raise?.to_level;
    return to === undefined ? e : { ...e, config: { ...e.config, level: to } };
  });
}
