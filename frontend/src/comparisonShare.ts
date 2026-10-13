// Sharing a comparison (PRD 0020): what a share carries, and how an opened one
// becomes the comparison again.
import type { ComparisonMap } from "./comparisonMap";
import type { Lang } from "./i18n";
import { newEntry, type RosterEntry } from "./roster";
import { formatHm } from "./sleep";
import type { ComparisonShare, ComparisonShareInput, SleepSchedule } from "./types";

/** The query parameter a share link lands on: `/compare?share=<id>`. */
export const SHARE_PARAM = "share";

export function shareIdFrom(search: string): string | null {
  const id = new URLSearchParams(search).get(SHARE_PARAM);
  return id && id.trim() ? id.trim() : null;
}

/** A share copies the cards' configs, never their tie to the sharer's Box. */
export function shareRequest(
  entries: RosterEntry[],
  map: ComparisonMap,
  sleep: SleepSchedule,
  lang: Lang,
  image: ComparisonShareInput["image"],
  verificationToken: string | null,
): ComparisonShareInput {
  return {
    members: entries.map((e) => e.config),
    island: map.island,
    favorites: map.favorites,
    weekly_bonus: map.weeklyBonus,
    language: lang,
    sleep,
    image,
    verification_token: verificationToken,
  };
}

/** An opened share as fresh, unlinked cards, its map terms, and the sharer's sleep. */
export function sessionFromShare(share: ComparisonShare): {
  entries: RosterEntry[];
  map: ComparisonMap;
  sleep: SleepSchedule;
} {
  return {
    entries: share.members.map((m) => newEntry(m)),
    map: { island: share.island, favorites: share.favorites, weeklyBonus: share.weekly_bonus },
    sleep: share.sleep,
  };
}

export function sleepDiffers(a: SleepSchedule, b: SleepSchedule): boolean {
  return a.night_minutes !== b.night_minutes || (a.nap_minutes ?? null) !== (b.nap_minutes ?? null);
}

/** "8:30", or "7:00 + siesta 2:00" with a nap (napWord is the language's word for it). */
export function formatSleep(s: SleepSchedule, napWord: string): string {
  const night = formatHm(s.night_minutes);
  return s.nap_minutes == null ? night : `${night} + ${napWord} ${formatHm(s.nap_minutes)}`;
}
