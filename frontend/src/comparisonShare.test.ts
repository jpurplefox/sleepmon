import { describe, expect, it } from "vitest";

import { sessionFromShare, shareIdFrom, shareRequest } from "./comparisonShare";
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
      "en",
      image,
    );
    expect(req).toEqual({
      members: [pikachu],
      island: "Cyan Beach (Expert)",
      favorites: ["", "Oran"],
      weekly_bonus: "ingredient",
      language: "en",
      image,
    });
    expect(JSON.stringify(req)).not.toContain("box-member-1");
  });
});

describe("sessionFromShare", () => {
  it("opens the share as fresh unlinked cards with its map terms", () => {
    const share: ComparisonShare = {
      id: "abc",
      url: "https://sleepmon.app/s/abc",
      members: [pikachu, { ...pikachu, level: 50 }],
      island: null,
      favorites: ["Grepa"],
      weekly_bonus: "berry_strength",
    };
    const { entries, map } = sessionFromShare(share);
    expect(entries.map((e) => e.config.level)).toEqual([30, 50]);
    expect(entries.every((e) => e.sourceId === undefined)).toBe(true);
    expect(new Set(entries.map((e) => e.id)).size).toBe(2);
    expect(map).toEqual({ island: null, favorites: ["Grepa"], weeklyBonus: "berry_strength" });
  });
});
