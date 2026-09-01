import { describe, expect, it } from "vitest";

import { configFromMember, newEntry } from "./roster";
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
        ["Fancy Apple", "Warming Ginger"],
        ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
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
      "Fancy Apple",
      "Fancy Apple",
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
