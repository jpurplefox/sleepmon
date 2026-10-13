import { describe, expect, it } from "vitest";

import { formatSleep, sessionFromShare, shareIdFrom, shareRequest, sleepDiffers } from "./comparisonShare";
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
    expect(formatSleep({ night_minutes: 420, nap_minutes: 120 }, "siesta")).toBe("7:00 + siesta 2:00");
    expect(formatSleep({ night_minutes: 420, nap_minutes: 120 }, "nap")).toBe("7:00 + nap 2:00");
  });
});
