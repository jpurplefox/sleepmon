import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetShareCacheForTests,
  cachedShareUrl,
  displayUrl,
  formatSleep,
  pendingShare,
  rememberShareUrl,
  sessionFromShare,
  shareCacheKey,
  shareIdFrom,
  shareRequest,
  trackPendingShare,
  sleepDiffers,
  sleepNoticeParts,
} from "./comparisonShare";
import type { ComparisonMap } from "./comparisonMap";
import { UI } from "./i18n/ui";
import type { Lang } from "./i18n/terms";
import { newEntry } from "./roster";
import type { ComparisonShare, MemberInput } from "./types";

const pikachu: MemberInput = {
  species: "Pikachu",
  level: 30,
  nature: "Adamant",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: [],
  ribbon: "",
  skill_level: 1,
};

describe("shareIdFrom", () => {
  it("reads the share id from the query", () => {
    expect(shareIdFrom("?share=abc123")).toBe("abc123");
    expect(shareIdFrom("share=abc123&x=1")).toBe("abc123");
  });

  it("is null without one", () => {
    expect(shareIdFrom("")).toBeNull();
    expect(shareIdFrom("?share=")).toBeNull();
  });
});

describe("shareRequest", () => {
  it("copies the configs and map terms, never the tie to the Box", () => {
    const image = { media_type: "image/jpeg" as const, data: "AAAA" };
    const req = shareRequest(
      [newEntry(pikachu, "box-member-1")],
      { island: "Cyan Beach (Expert)", favorites: ["", "Oran"], weeklyBonus: "ingredient" },
      { night_minutes: 420, nap_minutes: 120 },
      "en",
      image,
      "tok",
    );
    expect(req).toEqual({
      members: [pikachu],
      island: "Cyan Beach (Expert)",
      favorites: ["", "Oran"],
      weekly_bonus: "ingredient",
      language: "en",
      sleep: { night_minutes: 420, nap_minutes: 120 },
      image,
      verification_token: "tok",
    });
    expect(JSON.stringify(req)).not.toContain("box-member-1");
  });
});

describe("sessionFromShare", () => {
  it("opens the share as fresh unlinked cards with its map terms and sleep", () => {
    const share: ComparisonShare = {
      id: "abc",
      url: "https://sleepmon.app/s/abc",
      members: [pikachu, { ...pikachu, level: 50 }],
      island: null,
      favorites: ["Grepa"],
      weekly_bonus: "berry_strength",
      sleep: { night_minutes: 420, nap_minutes: 120 },
    };
    const result = sessionFromShare(share);
    expect(result.entries.map((e) => e.config.level)).toEqual([30, 50]);
    expect(result.entries.every((e) => e.sourceId === undefined)).toBe(true);
    expect(new Set(result.entries.map((e) => e.id)).size).toBe(2);
    expect(result.map).toEqual({ island: null, favorites: ["Grepa"], weeklyBonus: "berry_strength" });
    expect(result.sleep).toEqual({ night_minutes: 420, nap_minutes: 120 });
  });
});

describe("sleepDiffers", () => {
  it("compares night and nap, no nap equal to no nap", () => {
    expect(sleepDiffers({ night_minutes: 510, nap_minutes: null }, { night_minutes: 510, nap_minutes: null })).toBe(false);
    expect(sleepDiffers({ night_minutes: 420, nap_minutes: 120 }, { night_minutes: 510, nap_minutes: null })).toBe(true);
    expect(sleepDiffers({ night_minutes: 510, nap_minutes: 120 }, { night_minutes: 510, nap_minutes: null })).toBe(true);
  });
});

describe("formatSleep", () => {
  it("reads the night, plus the nap when there is one", () => {
    expect(formatSleep({ night_minutes: 510, nap_minutes: null }, "siesta")).toBe("8:30");
    expect(formatSleep({ night_minutes: 510, nap_minutes: undefined as unknown as null }, "siesta")).toBe("8:30");
    expect(formatSleep({ night_minutes: 420, nap_minutes: 120 }, "siesta")).toBe("7:00 + siesta 2:00");
    expect(formatSleep({ night_minutes: 420, nap_minutes: 120 }, "nap")).toBe("7:00 + nap 2:00");
  });
});

describe("sleepNoticeParts", () => {
  const tFor = (lang: Lang) => (key: string, vars?: Record<string, string>) =>
    UI[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => vars?.[k] ?? `{${k}}`);
  const one = (n: number) => ({ night_minutes: n, nap_minutes: null });
  const two = (n: number, p: number) => ({ night_minutes: n, nap_minutes: p });

  it("es: names each side's sessions, shortening yours when the counts match", () => {
    const t = tFor("es");
    expect(sleepNoticeParts(two(420, 120), one(510), t)).toEqual({
      theirs: "dos sesiones (noche 7:00 y siesta 2:00)",
      yours: "una sesión de 8:30",
    });
    expect(sleepNoticeParts(one(510), two(420, 120), t)).toEqual({
      theirs: "una sesión de 8:30",
      yours: "dos sesiones (noche 7:00 y siesta 2:00)",
    });
    expect(sleepNoticeParts(one(510), one(600), t)).toEqual({ theirs: "una sesión de 8:30", yours: "una de 10:00" });
    expect(sleepNoticeParts(two(420, 120), two(480, 90), t)).toEqual({
      theirs: "dos sesiones (noche 7:00 y siesta 2:00)",
      yours: "dos (noche 8:00 y siesta 1:30)",
    });
  });

  it("en: the same four cases", () => {
    const t = tFor("en");
    expect(sleepNoticeParts(two(420, 120), one(510), t)).toEqual({
      theirs: "two sessions (night 7:00 and nap 2:00)",
      yours: "one session of 8:30",
    });
    expect(sleepNoticeParts(one(510), two(420, 120), t).yours).toBe("two sessions (night 7:00 and nap 2:00)");
    expect(sleepNoticeParts(one(510), one(600), t)).toEqual({ theirs: "one session of 8:30", yours: "one of 10:00" });
    expect(sleepNoticeParts(two(420, 120), two(480, 90), t).yours).toBe("two (night 8:00 and nap 1:30)");
  });

  it("the notice sentence reads in both languages", () => {
    expect(UI.es["share.sleepNotice"]).toBe(
      "Quien te compartió esta comparación duerme en {theirs} y vos en {yours}, así que los valores mostrados pueden no coincidir con los suyos.",
    );
    expect(UI.en["share.sleepNotice"]).toBe(
      "The person who shared this comparison sleeps in {theirs} and you in {yours}, so the values shown may not match theirs.",
    );
  });
});

describe("shareCacheKey", () => {
  const map: ComparisonMap = { island: null, favorites: ["Grepa"], weeklyBonus: "berry_strength" };
  const sleep = { night_minutes: 510, nap_minutes: null };
  const key = (overrides: Partial<{ level: number; favorites: string[]; night: number; lang: Lang }> = {}) =>
    shareCacheKey(
      [newEntry({ ...pikachu, level: overrides.level ?? 30 }), newEntry(pikachu)],
      { ...map, favorites: overrides.favorites ?? map.favorites },
      { ...sleep, night_minutes: overrides.night ?? sleep.night_minutes },
      overrides.lang ?? "es",
    );

  it("is the same for the same comparison, whatever the cards' ids", () => {
    expect(key()).toBe(key());
  });

  it("changes with the cards, the map terms, the sleep and the language", () => {
    expect(key({ level: 31 })).not.toBe(key());
    expect(key({ favorites: [] })).not.toBe(key());
    expect(key({ night: 480 })).not.toBe(key());
    expect(key({ lang: "en" })).not.toBe(key());
  });
});

describe("the link cache", () => {
  beforeEach(() => __resetShareCacheForTests());

  it("remembers a link by its key for the session", () => {
    expect(cachedShareUrl("k")).toBeUndefined();
    rememberShareUrl("k", "https://sleepmon.app/s/1");
    expect(cachedShareUrl("k")).toBe("https://sleepmon.app/s/1");
    expect(cachedShareUrl("other")).toBeUndefined();
  });
});

describe("pending shares", () => {
  beforeEach(() => __resetShareCacheForTests());

  it("keeps an in-flight creation until it settles", async () => {
    let done!: (u: string) => void;
    const p = new Promise<string>((r) => (done = r));
    trackPendingShare("k", p);
    expect(pendingShare("k")).toBe(p);
    done("u");
    await p;
    await Promise.resolve();
    expect(pendingShare("k")).toBeUndefined();
  });

  it("does not keep a rejected creation", async () => {
    const p = Promise.reject(new Error("x"));
    trackPendingShare("k", p);
    await p.catch(() => {});
    await Promise.resolve();
    expect(pendingShare("k")).toBeUndefined();
  });
});

describe("displayUrl", () => {
  it("drops an https scheme", () => {
    expect(displayUrl("https://sleepmon.app/s/abc123")).toBe("sleepmon.app/s/abc123");
  });

  it("drops an http scheme", () => {
    expect(displayUrl("http://localhost:8000/s/abc123")).toBe("localhost:8000/s/abc123");
  });

  it("leaves a URL without a scheme unchanged", () => {
    expect(displayUrl("sleepmon.app/s/abc123")).toBe("sleepmon.app/s/abc123");
  });
});
