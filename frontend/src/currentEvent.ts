// The event running now, preloaded into Team Analysis's event bonus (PRD 0012).
// Update it each week by hand; set it to `null` when no event is running.
import type { EventEffect } from "./eventBonus";

export interface PresetEvent {
  name: string;
  /** Local start time (inclusive), as the game announces it. */
  start: Date;
  /** Local end time (exclusive). */
  end: Date;
  effects: Omit<EventEffect, "id">[];
}

// Running: Dream Shard Week Vol. 3 (Nov 23 – Nov 30). Every helper's main skill is 1.25× as
// likely to trigger. Not modeled: the ×1.5 Dream Shards from sleep research and from main skills
// (shards are not part of the production estimate) and the Mini Candy Boost. Good Sleep Day #41
// (Nov 23 – 26) doesn't touch production; set this to `null` when the event ends.
export const CURRENT_EVENT: PresetEvent | null = {
  name: "Dream Shard Week Vol. 3",
  start: new Date(2026, 10, 23, 4, 0),
  end: new Date(2026, 10, 30, 4, 0),
  effects: [{ kind: "skill_trigger", value: 1.25, scope: { kind: "team" } }],
};

/** The preset's effects if it is running at `now`; otherwise none. */
export function presetEffects(
  event: PresetEvent | null,
  now: Date,
  newId: () => string,
): EventEffect[] {
  if (!event || now < event.start || now >= event.end) return [];
  return event.effects.map((e) => ({ id: newId(), ...e }));
}
