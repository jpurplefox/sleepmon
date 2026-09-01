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

export function newEntry(config: MemberInput, sourceId?: string): RosterEntry {
  return { id: crypto.randomUUID(), config, ...(sourceId ? { sourceId } : {}) };
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
