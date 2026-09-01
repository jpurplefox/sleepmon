// The team roster: an ordered list of slots, each holding one Pokémon or two
// sharing it over the week. Mutations are pure so the rules are testable without the page.
import type { RosterEntry } from "./roster";
import type { MemberInput, TeamProductionInput } from "./types";

export const MAX_TEAM = 5;

export interface Slot {
  entries: RosterEntry[]; // 1 or 2
  // The first entry's time share, 0..1 (a slot of one is always 100%). One
  // number instead of a weight per entry makes "weights sum to 1" true by construction.
  share: number;
}

export function weightsOf(slot: Slot): number[] {
  return slot.entries.length === 2 ? [slot.share, 1 - slot.share] : [1];
}

export function addSlot(slots: Slot[], entry: RosterEntry): Slot[] {
  if (slots.length >= MAX_TEAM) return slots;
  return [...slots, { entries: [entry], share: 1 }];
}

export function splitSlot(slots: Slot[], slotIndex: number, entry: RosterEntry): Slot[] {
  return slots.map((s, i) =>
    i === slotIndex && s.entries.length === 1
      ? { entries: [...s.entries, entry], share: 0.5 }
      : s,
  );
}

export function replaceConfig(
  slots: Slot[],
  slotIndex: number,
  entryIndex: number,
  config: MemberInput,
): Slot[] {
  return slots.map((s, i) =>
    i === slotIndex
      ? {
          ...s,
          entries: s.entries.map((e, j) => (j === entryIndex ? { ...e, config } : e)),
        }
      : s,
  );
}

export function linkToBox(slots: Slot[], entryId: string, memberId: string): Slot[] {
  return slots.map((s) => ({
    ...s,
    entries: s.entries.map((e) => (e.id === entryId ? { ...e, sourceId: memberId } : e)),
  }));
}

export function removeSlot(slots: Slot[], slotIndex: number): Slot[] {
  return slots.filter((_, i) => i !== slotIndex);
}

// Removing one half of a split slot leaves the other at 100%. A slot never
// empties: dropping the last Pokémon is removing the slot (removeSlot).
export function removeEntry(slots: Slot[], slotIndex: number, entryIndex: number): Slot[] {
  return slots.map((s, i) => {
    if (i !== slotIndex) return s;
    const kept = s.entries.filter((_, j) => j !== entryIndex);
    return kept.length === 0 ? s : { entries: kept, share: 1 };
  });
}

// pctA is the first entry's percentage, 1..99.
export function setSplitShare(slots: Slot[], slotIndex: number, pctA: number): Slot[] {
  return slots.map((s, i) =>
    i === slotIndex && s.entries.length === 2 ? { ...s, share: pctA / 100 } : s,
  );
}

export function toRequest(slots: Slot[]): TeamProductionInput["slots"] {
  return slots.map((s) => {
    const weights = weightsOf(s);
    return {
      entries: s.entries.map((e, i) => ({
        id: e.id,
        weight: weights[i],
        pokemon: e.config,
      })),
    };
  });
}
