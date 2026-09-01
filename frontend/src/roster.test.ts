import { describe, expect, it } from "vitest";

import { configFromMember, linkEntryToBox, newEntry } from "./roster";
import type { Catalog, Member, MemberInput } from "./types";

const catalog = {
  species: [
    {
      name: "Pikachu",
      dex: 25,
      berry: "Grepa Berry",
      specialty: "Berries",
      ingredient_slots: [
        ["Fancy Apple"],
        ["Warming Ginger"],
        ["Fancy Egg"],
      ],
    },
  ],
} as unknown as Catalog;

const member = (over: Partial<Member> = {}): Member =>
  ({
    id: "box-1",
    species: "Pikachu",
    level: 30,
    nature: "Adamant",
    ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
    sub_skills: ["Helping Speed S"],
    ribbon: "",
    skill_level: 1,
    ...over,
  }) as Member;

const config: MemberInput = {
  species: "Pikachu",
  level: 30,
  nature: "Adamant",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: ["Helping Speed S"],
  ribbon: "",
  skill_level: 1,
};

describe("configFromMember", () => {
  it("copies the member's config", () => {
    expect(configFromMember(catalog, member())).toEqual(config);
  });

  it("fills a missing ingredient slot with the first option the species allows", () => {
    const partial = member({ ingredients: ["Fancy Apple"] });
    expect(configFromMember(catalog, partial)?.ingredients).toEqual([
      "Fancy Apple",
      "Warming Ginger",
      "Fancy Egg",
    ]);
  });

  it("returns null for a species outside the catalog", () => {
    expect(configFromMember(catalog, member({ species: "Missingno" }))).toBeNull();
  });
});

describe("newEntry", () => {
  it("gives every entry its own id, even for identical configs", () => {
    const a = newEntry(config);
    const b = newEntry(config);
    expect(a.id).not.toBe(b.id);
    expect(a.sourceId).toBeUndefined();
  });

  it("remembers the Box member it was copied from", () => {
    expect(newEntry(config, "box-1").sourceId).toBe("box-1");
  });
});

describe("linkEntryToBox", () => {
  it("tags only the entry matching the given id, leaving the others untouched", () => {
    const a = newEntry(config);
    const b = newEntry(config, "box-existing");
    const c = newEntry(config);
    const result = linkEntryToBox([a, b, c], a.id, "box-9");

    expect(result.find((e) => e.id === a.id)?.sourceId).toBe("box-9");
    expect(result.find((e) => e.id === b.id)?.sourceId).toBe("box-existing");
    expect(result.find((e) => e.id === c.id)?.sourceId).toBeUndefined();
  });

  it("changes nothing when the id matches no entry", () => {
    const a = newEntry(config);
    const b = newEntry(config, "box-existing");
    const result = linkEntryToBox([a, b], "no-such-id", "box-9");

    expect(result).toEqual([a, b]);
  });

  it("does not mutate the input array or its entries", () => {
    const a = newEntry(config);
    const b = newEntry(config);
    const entries = [a, b];
    const result = linkEntryToBox(entries, a.id, "box-9");

    expect(result).not.toBe(entries);
    expect(entries).toEqual([a, b]);
    expect(a.sourceId).toBeUndefined();
  });
});
