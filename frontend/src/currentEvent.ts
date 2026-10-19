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

// Scheduled: Halloween 2026 Double Candy Research (Oct 26 – Nov 2, Greengrass Isle). Its Ghost
// helper bonuses apply in every event area; the candy and Snorlax berry bonuses don't touch
// production. Replace it with the next production-affecting event once this one ends.
export const CURRENT_EVENT: PresetEvent | null = {
  name: "Halloween 2026",
  start: new Date(2026, 9, 26, 4, 0),
  end: new Date(2026, 10, 2, 4, 0),
  effects: [
    { kind: "extra_ingredients", value: 1, scope: { kind: "type", type: "Ghost" } },
    { kind: "skill_trigger", value: 1.25, scope: { kind: "type", type: "Ghost" } },
    { kind: "skill_level", value: 3, scope: { kind: "type", type: "Ghost" } },
  ],
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
