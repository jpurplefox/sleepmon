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

// No production-affecting event is running: Pokémon Growth Week Vol. 6 (Oct 12–19) only
// boosts sleep EXP and candies, and New Moon Day only raises mythical spawn rates.
export const CURRENT_EVENT: PresetEvent | null = null;

/** The preset's effects if it is running at `now`; otherwise none. */
export function presetEffects(
  event: PresetEvent | null,
  now: Date,
  newId: () => string,
): EventEffect[] {
  if (!event || now < event.start || now >= event.end) return [];
  return event.effects.map((e) => ({ id: newId(), ...e }));
}
