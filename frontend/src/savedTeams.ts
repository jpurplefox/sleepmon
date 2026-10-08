// Saved teams (PRD 0016): the pure rules between Team Analysis's session and a
// saved line-up. A saved team records Box member ids; the session holds configs.
import { pickedFavorites, slotsWithMainFirst } from "./favoriteSlots";
import { configFromMember, newEntry, type RosterEntry } from "./roster";
import type { Slot } from "./teamRoster";
import type {
  Catalog,
  DishType,
  MealInput,
  Member,
  MemberInput,
  SavedTeam,
  SavedTeamInput,
  WeeklyBonus,
} from "./types";

export const MAX_TEAM_NAME = 40;

/** What Team Analysis holds that a saved team keeps (the event and ticket are not). */
export interface TeamDefinition {
  slots: Slot[];
  meals: (MealInput | null)[];
  dishType: DishType | null;
  island: string | null;
  favoriteBerries: string[];
  mainFavorite: string | null;
  weeklyBonus: WeeklyBonus;
}

export type MembersById = ReadonlyMap<string, Member>;

export function membersById(members: readonly Member[] | undefined): MembersById {
  return new Map((members ?? []).map((m) => [m.id, m]));
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Field by field: a config edited in the form may list its keys in another order. */
export function sameConfig(a: MemberInput, b: MemberInput): boolean {
  return (
    a.species === b.species &&
    a.level === b.level &&
    a.nature === b.nature &&
    a.ribbon === b.ribbon &&
    a.skill_level === b.skill_level &&
    sameList(a.ingredients, b.ingredients) &&
    sameList(a.sub_skills, b.sub_skills)
  );
}

export type BoxWrite = { entry: RosterEntry; kind: "new" | "update" };

/**
 * What saving the team must first write to the Box: entries created on the spot
 * (or whose Box entry is gone) are new; entries whose config differs from their
 * Box entry are updates. Each entry is listed once, even if it sits in two slots.
 */
export function boxWritesFor(slots: Slot[], members: MembersById, catalog: Catalog): BoxWrite[] {
  const writes: BoxWrite[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    for (const entry of slot.entries) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const member = entry.sourceId ? members.get(entry.sourceId) : undefined;
      if (!member) {
        writes.push({ entry, kind: "new" });
        continue;
      }
      const boxConfig = configFromMember(catalog, member);
      if (!boxConfig || !sameConfig(boxConfig, entry.config)) writes.push({ entry, kind: "update" });
    }
  }
  return writes;
}

/** The request body for a definition whose entries are all linked to the Box. */
export function toSavedTeamInput(name: string, def: TeamDefinition): SavedTeamInput {
  return {
    name: name.trim(),
    slots: def.slots.map((s) => ({
      members: s.entries.map((e) => {
        if (!e.sourceId) throw new Error("Every member must be in the Box before saving.");
        return e.sourceId;
      }),
      share: s.entries.length === 2 ? s.share : 1,
    })),
    island: def.island,
    favorite_berries: pickedFavorites(def.favoriteBerries),
    main_favorite: def.mainFavorite,
    weekly_bonus: def.weeklyBonus,
    dish_type: def.dishType,
    meals: [0, 1, 2].map((i) => def.meals[i]?.recipe ?? null),
  };
}

/**
 * Loads a saved team into a session definition, each member as it is in the Box
 * now. A member that is gone or outside the catalog is skipped (its species, when
 * known, is reported); a split left with one member goes to 100%.
 */
export function definitionFromSavedTeam(
  team: SavedTeam,
  members: MembersById,
  catalog: Catalog,
  levelFor: (recipe: string) => number,
): { definition: TeamDefinition; skipped: string[] } {
  const skipped: string[] = [];
  const slots: Slot[] = [];
  for (const saved of team.slots) {
    const entries: RosterEntry[] = [];
    for (const id of saved.members) {
      const member = members.get(id);
      const config = member ? configFromMember(catalog, member) : null;
      if (!member || !config) {
        if (member) skipped.push(member.species);
        continue;
      }
      entries.push(newEntry(config, id));
    }
    if (entries.length === 0) continue;
    slots.push({ entries, share: entries.length === 2 ? saved.share : 1 });
  }
  return {
    definition: {
      slots,
      meals: [0, 1, 2].map((i) => {
        const recipe = team.meals[i] ?? null;
        return recipe === null ? null : { recipe, level: levelFor(recipe) };
      }),
      dishType: team.dish_type,
      island: team.island,
      favoriteBerries: slotsWithMainFirst(team.favorite_berries, team.main_favorite),
      mainFavorite: team.main_favorite,
      weeklyBonus: team.weekly_bonus,
    },
    skipped,
  };
}

const SHARE_EPSILON = 1e-9;

/**
 * Whether the session differs from the saved team: a slot added, removed or
 * reordered, a member swapped or edited (its config no longer the Box's), a
 * weight moved, or the map, berries, weekly bonus, dish type or a meal changed.
 * Recipe levels are the profile's, so only the recipe names count.
 */
export function isUnsaved(
  def: TeamDefinition,
  saved: SavedTeam,
  members: MembersById,
  catalog: Catalog,
): boolean {
  if (def.slots.length !== saved.slots.length) return true;
  for (let i = 0; i < def.slots.length; i++) {
    const slot = def.slots[i];
    const savedSlot = saved.slots[i];
    if (slot.entries.length !== savedSlot.members.length) return true;
    const share = slot.entries.length === 2 ? slot.share : 1;
    if (Math.abs(share - savedSlot.share) > SHARE_EPSILON) return true;
    for (let j = 0; j < slot.entries.length; j++) {
      const entry = slot.entries[j];
      if (entry.sourceId !== savedSlot.members[j]) return true;
    }
  }
  if (boxWritesFor(def.slots, members, catalog).length > 0) return true;
  const recipes = [0, 1, 2].map((i) => def.meals[i]?.recipe ?? null);
  return (
    def.island !== saved.island ||
    !sameList(pickedFavorites(def.favoriteBerries).sort(), [...saved.favorite_berries].sort()) ||
    def.mainFavorite !== saved.main_favorite ||
    def.weeklyBonus !== saved.weekly_bonus ||
    def.dishType !== saved.dish_type ||
    recipes.some((r, i) => r !== (saved.meals[i] ?? null))
  );
}

export type NameError = "empty" | "tooLong" | "taken";

/** Why a name can't be used, or null. `ownId` is the team being saved over or renamed. */
export function nameError(
  name: string,
  teams: readonly SavedTeam[],
  ownId: string | null,
): NameError | null {
  const trimmed = name.trim();
  if (trimmed === "") return "empty";
  if (trimmed.length > MAX_TEAM_NAME) return "tooLong";
  const key = trimmed.toLocaleLowerCase();
  if (teams.some((t) => t.id !== ownId && t.name.trim().toLocaleLowerCase() === key))
    return "taken";
  return null;
}

/** Whether a team holds the Box member, in a single slot or a split. */
export function holdsMember(team: SavedTeam, memberId: string): boolean {
  return team.slots.some((s) => s.members.includes(memberId));
}

/**
 * What deleting a Box member does to the saved teams: the ones it is in, and of
 * those, the ones deleted because it is their only member.
 */
export function deletionImpact(
  teams: readonly SavedTeam[],
  memberId: string,
): { inTeams: SavedTeam[]; deleted: SavedTeam[] } {
  const inTeams = teams.filter((t) => holdsMember(t, memberId));
  const deleted = inTeams.filter((t) => t.slots.every((s) => s.members.every((m) => m === memberId)));
  return { inTeams, deleted };
}

/** `undefined` = any; `null` = "No map" / "No type"; otherwise the value. */
export interface TeamFilters {
  island?: string | null;
  dishType?: DishType | null;
  memberId?: string;
}

export function hasFilters(f: TeamFilters): boolean {
  return f.island !== undefined || f.dishType !== undefined || f.memberId !== undefined;
}

export function filterTeams(teams: readonly SavedTeam[], f: TeamFilters): SavedTeam[] {
  return teams.filter(
    (t) =>
      (f.island === undefined || t.island === f.island) &&
      (f.dishType === undefined || t.dish_type === f.dishType) &&
      (f.memberId === undefined || holdsMember(t, f.memberId)),
  );
}
