import { describe, expect, it } from "vitest";

import { newEntry } from "./roster";
import type { MemberInput } from "./types";
import type { Slot } from "./teamRoster";
import {
  MAX_TEAM,
  addSlot,
  canAdd,
  linkToBox,
  removeEntry,
  removeSlot,
  replaceConfig,
  setSplitShare,
  splitSlot,
  teamResult,
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

describe("canAdd", () => {
  // canAdd must agree with what addSlot/splitSlot actually do.
  const lands = (before: Slot[], after: Slot[]) =>
    after.reduce((n, s) => n + s.entries.length, 0) > before.reduce((n, s) => n + s.entries.length, 0);

  it("adds a slot until the team is full", () => {
    for (let n = 0; n <= MAX_TEAM; n++) {
      const slots = teamOf(n);
      expect(canAdd(slots, { kind: "add" })).toBe(n < MAX_TEAM);
      expect(canAdd(slots, { kind: "add" })).toBe(lands(slots, addSlot(slots, newEntry(config()))));
    }
  });

  it("splits only a single-member slot that exists", () => {
    const single = teamOf(1);
    const split = splitSlot(single, 0, newEntry(config()));
    for (const [slots, i, expected] of [
      [single, 0, true],
      [split, 0, false],
      [single, 3, false],
    ] as const) {
      expect(canAdd(slots, { kind: "split", slotIndex: i })).toBe(expected);
      expect(lands(slots, splitSlot(slots, i, newEntry(config())))).toBe(expected);
    }
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
    const again = splitSlot(split, 0, newEntry(config()));
    expect(again[0].entries).toHaveLength(2);
    expect(again[0].entries).toEqual(split[0].entries);
    expect(again[0].share).toBe(split[0].share);
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

  it("only changes the targeted entry, leaving the rest untouched", () => {
    const withFirst = addSlot([], newEntry(config(10), "box-1"));
    const withSecond = addSlot(withFirst, newEntry(config(20)));
    // slots[1] is a split slot: entries[0] level 20, entries[1] level 21.
    const slots = splitSlot(withSecond, 1, newEntry(config(21)));

    const next = replaceConfig(slots, 1, 1, config(99));

    expect(next[1].entries[1].config.level).toBe(99);
    expect(next[1].entries[1].id).toBe(slots[1].entries[1].id);
    // The split slot's other entry is untouched.
    expect(next[1].entries[0]).toEqual(slots[1].entries[0]);
    // The other slot is untouched entirely.
    expect(next[0]).toEqual(slots[0]);
  });
});

describe("linkToBox", () => {
  it("records the Box member a saved entry now belongs to", () => {
    const slots = addSlot([], newEntry(config()));
    const id = slots[0].entries[0].id;
    expect(linkToBox(slots, id, "box-9")[0].entries[0].sourceId).toBe("box-9");
  });

  it("only sets sourceId on the entry whose id matches, leaving the rest alone", () => {
    const withFirst = addSlot([], newEntry(config(10)));
    const withSecond = addSlot(withFirst, newEntry(config(20)));
    // slots[1] is a split slot: entries[0] level 20, entries[1] level 21.
    const slots = splitSlot(withSecond, 1, newEntry(config(21)));
    const targetId = slots[1].entries[1].id;

    const next = linkToBox(slots, targetId, "box-9");

    expect(next[1].entries[1].sourceId).toBe("box-9");
    expect(next[0].entries[0].sourceId).toBeUndefined();
    expect(next[1].entries[0].sourceId).toBeUndefined();
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
  it("drops the targeted slot and keeps the others, in order", () => {
    const slots = [10, 20, 30].reduce(
      (acc, level) => addSlot(acc, newEntry(config(level))),
      [] as Slot[],
    );

    const next = removeSlot(slots, 1);

    expect(next).toHaveLength(2);
    expect(next.map((s) => s.entries[0].config.level)).toEqual([10, 30]);
    expect(next[0].entries[0].id).toBe(slots[0].entries[0].id);
    expect(next[1].entries[0].id).toBe(slots[2].entries[0].id);
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

describe("teamResult", () => {
  // The team query keeps its last data while a new one loads (no flicker), so the
  // cache still holds a result after the last Pokémon is removed.
  it("has none for an empty team, even with a result still cached", () => {
    expect(teamResult([], { total: 1 })).toBeUndefined();
  });

  it("is the computed one while the team has Pokémon", () => {
    const slots = addSlot([], newEntry(config()));
    expect(teamResult(slots, { total: 1 })).toEqual({ total: 1 });
    expect(teamResult(slots, undefined)).toBeUndefined();
  });
});
