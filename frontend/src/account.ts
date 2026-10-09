// Pure helpers for the account page (delete confirmation and "what you will lose" summary).
import { DEFAULT_POT_SIZE, EMPTY_PROGRESS } from "./progress";
import { sameSleep } from "./sleep";
import type { Member, PlayerProgress, SavedTeam } from "./types";

export interface AccountSummary {
  boxSize: number;
  savedTeams: number;
  hasProfile: boolean;
}

/** Whether the typed text confirms the account email (case and edge whitespace ignored). */
export function emailMatches(typed: string, email: string): boolean {
  const t = typed.trim();
  return t !== "" && t.toLowerCase() === email.trim().toLowerCase();
}

const isEmptyRecord = (r: object): boolean => Object.keys(r).length === 0;

/** True when the profile holds nothing beyond what an untouched account reads. */
export function isDefaultProgress(p: PlayerProgress): boolean {
  return (
    p.pot_size === DEFAULT_POT_SIZE &&
    isEmptyRecord(p.recipe_levels) &&
    isEmptyRecord(p.favorite_recipes) &&
    isEmptyRecord(p.area_bonuses) &&
    sameSleep(p.sleep, EMPTY_PROGRESS.sleep)
  );
}

export function accountSummary(
  members: readonly Member[],
  teams: readonly SavedTeam[],
  progress: PlayerProgress,
): AccountSummary {
  return {
    boxSize: members.length,
    savedTeams: teams.length,
    hasProfile: !isDefaultProgress(progress),
  };
}
