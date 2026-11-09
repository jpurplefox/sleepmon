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

// Scheduled: Bountiful Banquet Week Vol. 1 (Nov 16 – Nov 23). Ingredient specialists bring 1
// extra ingredient and carry 10 more. Not modeled: the Snackable Nut they also gather (not in the
// catalogue yet), the +50% Snackable Nut dish strength and the +30 pot capacity (the pot size
// effect is a multiplier and the base pot size varies). Replace it with the next
// production-affecting event once this one ends.
export const CURRENT_EVENT: PresetEvent | null = {
  name: "Bountiful Banquet Week Vol. 1",
  start: new Date(2026, 10, 16, 4, 0),
  end: new Date(2026, 10, 23, 4, 0),
  effects: [
    { kind: "extra_ingredients", value: 1, scope: { kind: "specialty", specialty: "Ingredients" } },
    { kind: "carry_limit", value: 10, scope: { kind: "specialty", specialty: "Ingredients" } },
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
