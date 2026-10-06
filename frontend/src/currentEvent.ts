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

// Packed Portions Cooking Week Part 3: Oct 5 (Mon) 4:00 a.m. – Oct 12 (Mon) 3:59 a.m.
export const CURRENT_EVENT: PresetEvent | null = {
  name: "Packed Portions Cooking Week Part 3",
  start: new Date(2026, 9, 5, 4, 0),
  end: new Date(2026, 9, 12, 4, 0),
  effects: [
    { kind: "extra_ingredients", value: 1, scope: { kind: "specialty", specialty: "Ingredients" } },
    { kind: "skill_ingredients", value: 1.5, scope: { kind: "team" } },
    { kind: "dish_strength", value: 1.25, scope: { kind: "team" } },
    { kind: "pot_size", value: 2, scope: { kind: "team" } },
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
