// Sharing a comparison (PRD 0020): what a share carries, and how an opened one
// becomes the comparison again.
import type { ComparisonMap } from "./comparisonMap";
import type { Lang } from "./i18n";
import { newEntry, type RosterEntry } from "./roster";
import type { ComparisonShare, ComparisonShareInput } from "./types";

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
  lang: Lang,
  image: ComparisonShareInput["image"],
): ComparisonShareInput {
  return {
    members: entries.map((e) => e.config),
    island: map.island,
    favorites: map.favorites,
    weekly_bonus: map.weeklyBonus,
    language: lang,
    image,
  };
}

/** An opened share as fresh, unlinked cards plus its map terms. */
export function sessionFromShare(share: ComparisonShare): { entries: RosterEntry[]; map: ComparisonMap } {
  return {
    entries: share.members.map((m) => newEntry(m)),
    map: { island: share.island, favorites: share.favorites, weeklyBonus: share.weekly_bonus },
  };
}
