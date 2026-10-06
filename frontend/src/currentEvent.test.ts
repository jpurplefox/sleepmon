import { describe, expect, it } from "vitest";

import { CURRENT_EVENT, presetEffects, type PresetEvent } from "./currentEvent";
import { EVENT_KINDS } from "./eventBonus";

const EVENT: PresetEvent = {
  name: "Test week",
  start: new Date(2026, 9, 5, 4, 0),
  end: new Date(2026, 9, 12, 4, 0),
  effects: [
    { kind: "extra_ingredients", value: 1, scope: { kind: "specialty", specialty: "Ingredients" } },
    { kind: "pot_size", value: 2, scope: { kind: "team" } },
  ],
};
let n = 0;
const id = () => `id-${++n}`;

describe("presetEffects", () => {
  it("preloads the effects while the event runs, each with its own id", () => {
    const effects = presetEffects(EVENT, new Date(2026, 9, 6, 12, 0), id);
    expect(effects.map(({ kind, value, scope }) => ({ kind, value, scope }))).toEqual(EVENT.effects);
    expect(new Set(effects.map((e) => e.id)).size).toBe(2);
  });
  it("includes the start and excludes the end", () => {
    expect(presetEffects(EVENT, EVENT.start, id)).toHaveLength(2);
    expect(presetEffects(EVENT, EVENT.end, id)).toEqual([]);
  });
  it("is empty before or after the event", () => {
    expect(presetEffects(EVENT, new Date(2026, 9, 5, 3, 59), id)).toEqual([]);
    expect(presetEffects(EVENT, new Date(2026, 9, 20), id)).toEqual([]);
  });
  it("is empty when no event is loaded", () => {
    expect(presetEffects(null, new Date(2026, 9, 6), id)).toEqual([]);
  });
});

describe("CURRENT_EVENT", () => {
  it("holds only values the editor accepts", () => {
    for (const e of CURRENT_EVENT?.effects ?? []) {
      const spec = EVENT_KINDS[e.kind];
      expect(e.value).toBeGreaterThanOrEqual(spec.min);
      expect(e.value).toBeLessThanOrEqual(spec.max);
      if (!spec.scoped) expect(e.scope).toEqual({ kind: "team" });
    }
  });
});
