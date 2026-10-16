import { describe, expect, it } from "vitest";

import { bakeRaisedLevels, COMPARISON_LEVELS, shownLevel } from "./comparisonLevel";
import { newEntry } from "./roster";
import type { MemberInput, Production } from "./types";

const cfg = (level: number): MemberInput => ({
  species: "Pikachu", level, nature: "", ingredients: [], sub_skills: [], ribbon: "", skill_level: 1,
});
const raisedTo = (from: number, to: number) =>
  ({ comparison_raise: { from_level: from, to_level: to, candies: 1803, dream_shards: 535149 } }) as Production;
const plain = { comparison_raise: null } as Production;

describe("COMPARISON_LEVELS", () => {
  it("is exactly the unlock levels", () => {
    expect(COMPARISON_LEVELS).toEqual([10, 25, 30, 50, 60, 70]);
  });
});

describe("shownLevel", () => {
  it("is the raise's target when raised", () => {
    expect(shownLevel(cfg(45), raisedTo(45, 60))).toBe(60);
  });
  it("is the card's own level otherwise", () => {
    expect(shownLevel(cfg(62), plain)).toBe(62);
    expect(shownLevel(cfg(45), null)).toBe(45);
    expect(shownLevel(cfg(45), undefined)).toBe(45);
  });
});

describe("bakeRaisedLevels", () => {
  it("puts each raised card at its target level, keeping ids and unraised cards", () => {
    const entries = [newEntry(cfg(45), "box-1"), newEntry(cfg(62))];
    const baked = bakeRaisedLevels(entries, [raisedTo(45, 60), plain]);
    expect(baked.map((e) => e.config.level)).toEqual([60, 62]);
    expect(baked.map((e) => e.id)).toEqual(entries.map((e) => e.id));
    expect(baked[1]).toBe(entries[1]);
  });
  it("never mutates the session's cards", () => {
    const entries = [newEntry(cfg(45))];
    bakeRaisedLevels(entries, [raisedTo(45, 60)]);
    expect(entries[0].config.level).toBe(45);
  });
});
