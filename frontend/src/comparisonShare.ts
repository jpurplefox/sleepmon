// Sharing a comparison (PRD 0020): what a share carries, and how an opened one
// becomes the comparison again.
import { DEFAULT_ISLAND, type ComparisonMap } from "./comparisonMap";
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

/** The link as shown in the dialog: its scheme dropped so it fits a phone; copying keeps the full URL. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "");
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
    map: {
      // Links from before Comparison named every map have no island: their
      // terms (pick your favorites, no expert effects) are Greengrass Isle's.
      island: share.island ?? DEFAULT_ISLAND,
      favorites: share.favorites,
      weeklyBonus: share.weekly_bonus,
    },
    sleep: share.sleep,
  };
}

export function sleepDiffers(a: SleepSchedule, b: SleepSchedule): boolean {
  return a.night_minutes !== b.night_minutes || (a.nap_minutes ?? null) !== (b.nap_minutes ?? null);
}

type Translate = (key: string, vars?: Record<string, string>) => string;

/** "one session of 8:30" / "two sessions (night 7:00 and nap 2:00)"; `short` drops the repeated noun. */
export function describeSessions(s: SleepSchedule, short: boolean, t: Translate): string {
  const night = formatHm(s.night_minutes);
  if (s.nap_minutes == null) return t(short ? "share.oneSessionShort" : "share.oneSession", { night });
  return t(short ? "share.twoSessionsShort" : "share.twoSessions", {
    night,
    nap: formatHm(s.nap_minutes),
  });
}

/** Both sides' sessions for the notice; yours is shortened when both have the same count. */
export function sleepNoticeParts(
  theirs: SleepSchedule,
  yours: SleepSchedule,
  t: Translate,
): { theirs: string; yours: string } {
  const sameCount = (theirs.nap_minutes == null) === (yours.nap_minutes == null);
  return {
    theirs: describeSessions(theirs, false, t),
    yours: describeSessions(yours, sameCount, t),
  };
}

/**
 * What makes two shares the same: the cards' configs (in order), the map terms, the
 * sharer's sleep and language. The cards' ids and Box ties don't count.
 */
export function shareCacheKey(entries: RosterEntry[], map: ComparisonMap, sleep: SleepSchedule, lang: Lang): string {
  return JSON.stringify({
    members: entries.map((e) => e.config),
    island: map.island,
    favorites: map.favorites,
    weekly_bonus: map.weeklyBonus,
    sleep: {
      night_minutes: sleep.night_minutes,
      nap_minutes: sleep.nap_minutes ?? null,
    },
    language: lang,
  });
}

// Links created in this session, by shareCacheKey: reopening the dialog on an unchanged
// comparison reuses its link. Session-only by design (lost on reload).
const shareUrls = new Map<string, string>();

export function cachedShareUrl(key: string): string | undefined {
  return shareUrls.get(key);
}

export function rememberShareUrl(key: string, url: string): void {
  shareUrls.set(key, url);
}

// Creations still in flight, by shareCacheKey: a dialog reopened on the same comparison
// mid-creation awaits the same request instead of creating a second link. A rejected
// creation is not kept, so the next dialog (or Try again) starts a fresh one.
const pendingShares = new Map<string, Promise<string>>();

export function pendingShare(key: string): Promise<string> | undefined {
  return pendingShares.get(key);
}

export function trackPendingShare(key: string, promise: Promise<string>): void {
  pendingShares.set(key, promise);
  const clear = () => {
    if (pendingShares.get(key) === promise) pendingShares.delete(key);
  };
  promise.then(clear, clear);
}

export function __resetShareCacheForTests(): void {
  shareUrls.clear();
  pendingShares.clear();
}
