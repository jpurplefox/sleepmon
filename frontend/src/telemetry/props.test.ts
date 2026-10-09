import { describe, expect, it } from "vitest";

import { newEntry } from "../roster";
import type { Slot } from "../teamRoster";
import type { Island, MemberInput } from "../types";
import {
  mapSetEvent,
  mealsCount,
  profileSections,
  sameMeals,
  teamAddedEvent,
  teamSavedProps,
} from "./props";

const cfg = (species: string): MemberInput => ({
  species, level: 30, nature: "", ingredients: [], sub_skills: [], ribbon: "", skill_level: 1,
});
const islands = [
  { name: "Greengrass Isle", expert: false },
  { name: "Greengrass Isle (Expert)", expert: true },
] as unknown as Island[];

describe("teamAddedEvent", () => {
  it("maps intent and origin to source and slot", () => {
    expect(teamAddedEvent("add", "box-1", "Pikachu")).toEqual({
      name: "pokemon_added",
      props: { tool: "team_analysis", source: "box", slot: "single", species: "Pikachu" },
    });
    expect(teamAddedEvent("split", undefined, "Raichu")).toEqual({
      name: "pokemon_added",
      props: { tool: "team_analysis", source: "new", slot: "split", species: "Raichu" },
    });
  });
});

describe("mapSetEvent", () => {
  it("reads the expert flag from the catalog", () => {
    expect(mapSetEvent("team_analysis", "Greengrass Isle (Expert)", islands).props).toEqual({
      tool: "team_analysis", island: "Greengrass Isle (Expert)", expert: true,
    });
  });
  it("reports no map as none", () => {
    expect(mapSetEvent("compare", null, islands).props).toEqual({ tool: "compare", island: "none", expert: false });
  });
});

describe("meals", () => {
  const a = [{ recipe: "Curry A", level: 1 }, null, null];
  it("counts filled meals", () => expect(mealsCount(a)).toBe(1));
  it("compares by recipe only", () => {
    expect(sameMeals(a, [{ recipe: "Curry A", level: 9 }, null, null])).toBe(true);
    expect(sameMeals(a, [null, null, null])).toBe(false);
  });
});

describe("profileSections", () => {
  it("lists the sections a patch touches", () => {
    expect(profileSections({ pot_size: 30, favorite_recipes: {}, sleep: { } as never })).toEqual(["kitchen", "recipes", "sleep"]);
    expect(profileSections({ area_bonuses: { X: 10 } })).toEqual(["areas"]);
    expect(profileSections({})).toEqual([]);
  });
});

describe("teamSavedProps", () => {
  it("summarises a 5-slot team with one split, 3 from the Box and 2 created", () => {
    const fromBox = ["b1", "b2", "b3"].map((id) => newEntry(cfg("Pikachu"), id));
    const fresh = [newEntry(cfg("Eevee")), newEntry(cfg("Raichu"))];
    const slots: Slot[] = [
      { entries: [fromBox[0]], share: 1 },
      { entries: [fromBox[1]], share: 1 },
      { entries: [fromBox[2], fresh[0]], share: 0.5 },
      { entries: [fresh[1]], share: 1 },
      { entries: [newEntry(cfg("Eevee"), "b4")], share: 1 },
    ];
    const props = teamSavedProps({
      kind: "new",
      slots,
      boxWrites: [{ entry: fresh[0], kind: "new" }, { entry: fresh[1], kind: "new" }],
      island: "Greengrass Isle (Expert)",
      islands,
      meals: [{ recipe: "Curry A", level: 1 }, { recipe: "Curry B", level: 1 }, null],
    });
    expect(props).toEqual({
      kind: "new", slots: 5, split_slots: 1, members_from_box: 4, members_created: 2,
      has_map: true, expert_map: true, meals: 2,
    });
  });
});
