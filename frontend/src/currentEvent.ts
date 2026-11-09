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

// Running: Meal Prep Week Vol. 1 (Nov 9 – Nov 16). Dish strength x1.25. The candy / Dream Shard
// bonuses and Mini Candy Boost don't touch production. Next up: Bountiful Banquet Week Vol. 1
// (Nov 16 – Nov 23): Ingredients specialists +1 extra ingredient and +10 carry (the Snackable Nut,
// its +50% dish strength and the +30 pot capacity aren't modeled). Swap it in when this ends.
export const CURRENT_EVENT: PresetEvent | null = {
  name: "Meal Prep Week Vol. 1",
  start: new Date(2026, 10, 9, 4, 0),
  end: new Date(2026, 10, 16, 4, 0),
  effects: [{ kind: "dish_strength", value: 1.25, scope: { kind: "team" } }],
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
