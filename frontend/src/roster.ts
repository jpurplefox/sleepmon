// The entry model shared by the tools that hold Pokémon without owning them
// (Comparison and Team Analysis): a config, its own id, and the Box member it
// was copied from, if any.
import type { Catalog, Member, MemberInput } from "./types";

export interface RosterEntry {
  // Stable per entry: the React key and the id the backend echoes back. Two
  // entries can hold identical configs, so the config cannot be the identity.
  id: string;
  config: MemberInput;
  // The Box member this was copied from; absent for one created on the spot.
  sourceId?: string;
}

// crypto.randomUUID is undefined outside a secure context (e.g. a LAN IP over
// plain http, used to check the layout on a real phone), so fall back to a
// timestamp + counter + random suffix — collision-free within a session and
// well under the backend's 64-char id bound.
let idCounter = 0;
function localId(): string {
  idCounter += 1;
  return `local-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newEntry(config: MemberInput, sourceId?: string): RosterEntry {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : localId();
  return { id, config, ...(sourceId ? { sourceId } : {}) };
}

// Match is by id, not position: a save resolves after the list may have been
// reordered, so the entry that was actually saved might no longer sit where
// it was when the save started.
export function linkEntryToBox(
  entries: RosterEntry[],
  entryId: string,
  memberId: string,
): RosterEntry[] {
  return entries.map((e) => (e.id === entryId ? { ...e, sourceId: memberId } : e));
}

// Copies a Box member into a config. Returns null when the species is outside
// the curated catalog: its ingredient slots are unknown, so no valid config
// exists and the caller must refuse the pick.
export function configFromMember(catalog: Catalog, m: Member): MemberInput | null {
  const species = catalog.species.find((s) => s.name === m.species);
  if (!species || species.ingredient_slots.length === 0) return null;
  return {
    species: m.species,
    level: m.level,
    nature: m.nature,
    ingredients: species.ingredient_slots.map((opts, i) => m.ingredients[i] ?? opts[0] ?? ""),
    sub_skills: m.sub_skills,
    ribbon: m.ribbon,
    skill_level: m.skill_level,
  };
}
