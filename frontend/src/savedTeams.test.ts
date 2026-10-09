import { describe, expect, it } from "vitest";

import { newEntry } from "./roster";
import {
  boxWritesFor,
  definitionFromSavedTeam,
  deletionImpact,
  filterTeams,
  isUnsaved,
  membersById,
  nameError,
  toSavedTeamInput,
  type TeamDefinition,
} from "./savedTeams";
import type { Catalog, Member, MemberInput, SavedTeam } from "./types";

const catalog = {
  species: [
    {
      name: "Pikachu",
      dex: 25,
      berry: "Grepa Berry",
      specialty: "Berries",
      ingredient_slots: [["Fancy Apple"], ["Warming Ginger"], ["Fancy Egg"]],
    },
  ],
} as unknown as Catalog;

const member = (id: string, over: Partial<Member> = {}): Member =>
  ({
    id,
    species: "Pikachu",
    level: 30,
    nature: "Adamant",
    ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
    sub_skills: ["Helping Speed S"],
    ribbon: "",
    skill_level: 1,
    ...over,
  }) as Member;

const config = (level = 30): MemberInput => ({
  species: "Pikachu",
  level,
  nature: "Adamant",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: ["Helping Speed S"],
  ribbon: "",
  skill_level: 1,
});

const team = (over: Partial<SavedTeam> = {}): SavedTeam => ({
  id: "t1",
  name: "Cyan curry",
  slots: [
    { members: ["a"], share: 1 },
    { members: ["b", "c"], share: 0.6 },
  ],
  island: "Cyan Beach",
  favorite_berries: ["Grepa Berry", "Pecha Berry", "Oran Berry"],
  main_favorite: null,
  weekly_bonus: "berry_strength",
  dish_type: "Curry",
  meals: ["Beanburger Curry", null, "Beanburger Curry"],
  saved_at: "2026-10-01T10:00:00Z",
  ...over,
});

const box = membersById([member("a"), member("b"), member("c")]);
const levelFor = () => 42;

const loaded = (t = team(), m = box): TeamDefinition =>
  definitionFromSavedTeam(t, m, catalog, levelFor).definition;

describe("definitionFromSavedTeam", () => {
  it("loads slots, weights, map and meals with the profile's recipe levels", () => {
    const def = loaded();
    expect(def.slots.map((s) => s.entries.map((e) => e.sourceId))).toEqual([["a"], ["b", "c"]]);
    expect(def.slots[1].share).toBe(0.6);
    expect(def.island).toBe("Cyan Beach");
    expect(def.favoriteBerries).toEqual(["Grepa Berry", "Pecha Berry", "Oran Berry"]);
    expect(def.dishType).toBe("Curry");
    expect(def.meals).toEqual([
      { recipe: "Beanburger Curry", level: 42 },
      null,
      { recipe: "Beanburger Curry", level: 42 },
    ]);
  });

  it("loads each member as it is in the Box now", () => {
    const def = loaded(team(), membersById([member("a", { level: 50 }), member("b"), member("c")]));
    expect(def.slots[0].entries[0].config.level).toBe(50);
  });

  it("skips a member outside the catalog and collapses its split to 100%", () => {
    const m = membersById([member("a"), member("b"), member("c", { species: "Mew" })]);
    const { definition, skipped } = definitionFromSavedTeam(team(), m, catalog, levelFor);
    expect(skipped).toEqual(["Mew"]);
    expect(definition.slots[1].entries).toHaveLength(1);
    expect(definition.slots[1].share).toBe(1);
  });
});

describe("isUnsaved", () => {
  it("is false right after loading", () => {
    expect(isUnsaved(loaded(), team(), box, catalog)).toBe(false);
  });

  it("is true when a weight moves, and false again when it moves back", () => {
    const def = loaded();
    const moved = { ...def, slots: [def.slots[0], { ...def.slots[1], share: 0.5 }] };
    expect(isUnsaved(moved, team(), box, catalog)).toBe(true);
    const back = { ...def, slots: [def.slots[0], { ...def.slots[1], share: 0.6 }] };
    expect(isUnsaved(back, team(), box, catalog)).toBe(false);
  });

  it("is true when a member is edited in the session", () => {
    const def = loaded();
    const edited = {
      ...def,
      slots: [{ ...def.slots[0], entries: [{ ...def.slots[0].entries[0], config: config(50) }] }, def.slots[1]],
    };
    expect(isUnsaved(edited, team(), box, catalog)).toBe(true);
  });

  it("is true when a Mew's chosen skill changes", () => {
    const def = loaded();
    const entry = def.slots[0].entries[0];
    const edited = {
      ...def,
      slots: [
        { ...def.slots[0], entries: [{ ...entry, config: { ...entry.config, versatile_skill: "Berry Burst" } }] },
        def.slots[1],
      ],
    };
    expect(isUnsaved(edited, team(), box, catalog)).toBe(true);
  });

  it("is true when the map, berries, dish type or a meal changes", () => {
    const def = loaded();
    expect(isUnsaved({ ...def, island: null }, team(), box, catalog)).toBe(true);
    expect(isUnsaved({ ...def, favoriteBerries: ["Grepa Berry"] }, team(), box, catalog)).toBe(true);
    expect(isUnsaved({ ...def, dishType: "Salad" }, team(), box, catalog)).toBe(true);
    expect(isUnsaved({ ...def, meals: [null, null, null] }, team(), box, catalog)).toBe(true);
  });

  it("ignores recipe levels and berry order", () => {
    const def = loaded();
    const other = {
      ...def,
      meals: def.meals.map((m) => (m ? { ...m, level: 1 } : m)),
      favoriteBerries: [...def.favoriteBerries].reverse(),
    };
    expect(isUnsaved(other, team(), box, catalog)).toBe(false);
  });

  it("is true when a slot is removed", () => {
    const def = loaded();
    expect(isUnsaved({ ...def, slots: [def.slots[0]] }, team(), box, catalog)).toBe(true);
  });
});

describe("boxWritesFor", () => {
  it("lists entries created on the spot as new and edited ones as updates, once each", () => {
    const fresh = newEntry(config());
    const edited = newEntry(config(50), "a");
    const same = newEntry(config(), "b");
    const writes = boxWritesFor(
      [
        { entries: [fresh], share: 1 },
        { entries: [edited, same], share: 0.5 },
      ],
      box,
      catalog,
    );
    expect(writes.map((w) => [w.entry.id, w.kind])).toEqual([
      [fresh.id, "new"],
      [edited.id, "update"],
    ]);
  });

  it("treats an entry whose Box Pokémon is gone as new", () => {
    const orphan = newEntry(config(), "deleted");
    expect(boxWritesFor([{ entries: [orphan], share: 1 }], box, catalog)[0].kind).toBe("new");
  });
});

describe("toSavedTeamInput", () => {
  it("writes member ids, a single slot at 1, and meal recipe names", () => {
    const input = toSavedTeamInput("  Cyan curry ", loaded());
    expect(input.name).toBe("Cyan curry");
    expect(input.slots).toEqual([
      { members: ["a"], share: 1 },
      { members: ["b", "c"], share: 0.6 },
    ]);
    expect(input.meals).toEqual(["Beanburger Curry", null, "Beanburger Curry"]);
  });

  it("refuses an entry that is not in the Box", () => {
    const def = { ...loaded(), slots: [{ entries: [newEntry(config())], share: 1 }] };
    expect(() => toSavedTeamInput("x", def)).toThrow();
  });
});

describe("nameError", () => {
  const teams = [team()];
  it("accepts a fresh name and the team's own name", () => {
    expect(nameError("Taupe", teams, null)).toBeNull();
    expect(nameError("cyan CURRY", teams, "t1")).toBeNull();
  });
  it("refuses empty, too long, and taken (ignoring case)", () => {
    expect(nameError("   ", teams, null)).toBe("empty");
    expect(nameError("x".repeat(41), teams, null)).toBe("tooLong");
    expect(nameError("x".repeat(40), teams, null)).toBeNull();
    expect(nameError(" cyan curry ", teams, null)).toBe("taken");
  });
});

describe("deletionImpact", () => {
  it("names the teams a member is in and the ones left empty", () => {
    const only = team({ id: "t2", name: "Solo", slots: [{ members: ["a"], share: 1 }] });
    const twice = team({ id: "t3", name: "Twice", slots: [{ members: ["a", "a"], share: 0.5 }] });
    const other = team({ id: "t4", name: "Other", slots: [{ members: ["b"], share: 1 }] });
    const { inTeams, deleted } = deletionImpact([team(), only, twice, other], "a");
    expect(inTeams.map((t) => t.name)).toEqual(["Cyan curry", "Solo", "Twice"]);
    expect(deleted.map((t) => t.name)).toEqual(["Solo", "Twice"]);
  });

  it("is empty for a member in no team", () => {
    expect(deletionImpact([team()], "z")).toEqual({ inTeams: [], deleted: [] });
  });
});

describe("filters", () => {
  const teams = [
    team({ id: "1", island: "Cyan Beach", dish_type: "Curry" }),
    team({ id: "2", island: "Cyan Beach", dish_type: "Salad", slots: [{ members: ["z"], share: 1 }] }),
    team({ id: "3", island: "Taupe Hollow", dish_type: "Curry" }),
    team({ id: "4", island: null, dish_type: null, slots: [{ members: ["x", "b"], share: 0.5 }] }),
  ];
  const ids = (f: Parameters<typeof filterTeams>[1]) => filterTeams(teams, f).map((t) => t.id);

  it("shows everything with no filter", () => {
    expect(ids({})).toEqual(["1", "2", "3", "4"]);
  });
  it("filters by map, by no map, and combines with dish type", () => {
    expect(ids({ island: "Cyan Beach" })).toEqual(["1", "2"]);
    expect(ids({ island: null })).toEqual(["4"]);
    expect(ids({ island: "Cyan Beach", dishType: "Curry" })).toEqual(["1"]);
  });
  it("filters by a Box entry, including in a split", () => {
    expect(ids({ memberId: "b" })).toEqual(["1", "3", "4"]);
  });
  it("accepts a map no team uses, and finds nothing", () => {
    expect(ids({ island: "Lapis Lakeside" })).toEqual([]);
  });
});
