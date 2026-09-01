import { describe, expect, it } from "vitest";

import { newEntry } from "./roster";
import type { MemberInput } from "./types";
import type { Slot } from "./teamRoster";
import {
  MAX_TEAM,
  addSlot,
  linkToBox,
  removeEntry,
  removeSlot,
  replaceConfig,
  setSplitShare,
  splitSlot,
  toRequest,
  weightsOf,
} from "./teamRoster";

const config = (level = 30): MemberInput => ({
  species: "Pikachu",
  level,
  nature: "Adamant",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: ["Helping Speed S"],
  ribbon: "",
  skill_level: 1,
});

const teamOf = (n: number): Slot[] => {
  let slots: Slot[] = [];
  for (let i = 0; i < n; i++) slots = addSlot(slots, newEntry(config()));
  return slots;
};

describe("addSlot", () => {
  it("appends a slot of one", () => {
    const slots = addSlot([], newEntry(config()));
    expect(slots).toHaveLength(1);
    expect(weightsOf(slots[0])).toEqual([1]);
  });

  it("accepts two identical configs as two Pokémon", () => {
    const slots = addSlot(addSlot([], newEntry(config())), newEntry(config()));
    expect(slots).toHaveLength(2);
    expect(slots[0].entries[0].id).not.toBe(slots[1].entries[0].id);
  });

  it("refuses to grow past MAX_TEAM", () => {
    const full = teamOf(MAX_TEAM);
    expect(addSlot(full, newEntry(config()))).toHaveLength(MAX_TEAM);
  });
});

describe("splitSlot", () => {
  it("fills the second half at 50/50", () => {
    const slots = splitSlot(teamOf(1), 0, newEntry(config()));
    expect(slots[0].entries).toHaveLength(2);
    expect(weightsOf(slots[0])).toEqual([0.5, 0.5]);
  });

  it("leaves an already split slot alone", () => {
    const split = splitSlot(teamOf(1), 0, newEntry(config()));
    expect(splitSlot(split, 0, newEntry(config()))[0].entries).toHaveLength(2);
  });
});

describe("setSplitShare", () => {
  it("derives both weights from the share so they always sum to 1", () => {
    const slots = setSplitShare(splitSlot(teamOf(1), 0, newEntry(config())), 0, 60);
    const [a, b] = weightsOf(slots[0]);
    expect(a).toBeCloseTo(0.6);
    expect(b).toBeCloseTo(0.4);
    expect(a + b).toBeCloseTo(1);
  });
});

describe("replaceConfig", () => {
  it("swaps the config and keeps the entry's id and origin", () => {
    const slots = addSlot([], newEntry(config(), "box-1"));
    const next = replaceConfig(slots, 0, 0, config(50));
    expect(next[0].entries[0].config.level).toBe(50);
    expect(next[0].entries[0].id).toBe(slots[0].entries[0].id);
    expect(next[0].entries[0].sourceId).toBe("box-1");
  });
});

describe("linkToBox", () => {
  it("records the Box member a saved entry now belongs to", () => {
    const slots = addSlot([], newEntry(config()));
    const id = slots[0].entries[0].id;
    expect(linkToBox(slots, id, "box-9")[0].entries[0].sourceId).toBe("box-9");
  });
});

describe("removeEntry", () => {
  it("collapses a split slot back to a single at 100%", () => {
    const split = splitSlot(teamOf(1), 0, newEntry(config()));
    const kept = split[0].entries[1].id;
    const next = removeEntry(split, 0, 0);
    expect(next[0].entries).toHaveLength(1);
    expect(next[0].entries[0].id).toBe(kept);
    expect(weightsOf(next[0])).toEqual([1]);
  });

  it("never empties a slot", () => {
    const single = teamOf(1);
    expect(removeEntry(single, 0, 0)[0].entries).toHaveLength(1);
  });
});

describe("removeSlot", () => {
  it("drops the slot", () => {
    expect(removeSlot(teamOf(2), 0)).toHaveLength(1);
  });
});

describe("toRequest", () => {
  it("emits every entry with its id, weight and config", () => {
    const slots = setSplitShare(splitSlot(teamOf(1), 0, newEntry(config())), 0, 60);
    const req = toRequest(slots);
    expect(req).toHaveLength(1);
    expect(req[0].entries.map((e) => e.weight)).toEqual([0.6, 0.4]);
    expect(req[0].entries[0].id).toBe(slots[0].entries[0].id);
    expect(req[0].entries[0].pokemon.species).toBe("Pikachu");
  });
});
