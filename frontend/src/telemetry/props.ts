// Pure builders for analytics events whose properties need a little derivation,
// so pages stay thin and the mapping is unit-tested.
import type { BoxWrite } from "../savedTeams";
import type { Slot } from "../teamRoster";
import type { Island, MealInput, ProgressPatch } from "../types";
import type { AnalyticsEvent, ProfileSection, TeamSavedProps } from "./events";

export function teamAddedEvent(
  intent: "add" | "split",
  sourceId: string | undefined,
  species: string,
): AnalyticsEvent {
  return {
    name: "pokemon_added",
    props: {
      tool: "team_analysis",
      source: sourceId ? "box" : "new",
      slot: intent === "split" ? "split" : "single",
      species,
    },
  };
}

export function mapSetEvent(
  tool: "compare" | "team_analysis",
  island: string | null,
  islands: readonly Island[],
): Extract<AnalyticsEvent, { name: "map_set" }> {
  const found = island === null ? undefined : islands.find((i) => i.name === island);
  return { name: "map_set", props: { tool, island: island ?? "none", expert: found?.expert ?? false } };
}

export const mealsCount = (meals: readonly (MealInput | null)[]): number =>
  meals.filter((m) => m !== null).length;

/** Same recipes in the same slots; levels do not count as a meals change. */
export function sameMeals(a: readonly (MealInput | null)[], b: readonly (MealInput | null)[]): boolean {
  return [0, 1, 2].every((i) => (a[i]?.recipe ?? null) === (b[i]?.recipe ?? null));
}

export function profileSections(patch: ProgressPatch): ProfileSection[] {
  const sections: ProfileSection[] = [];
  if (patch.pot_size !== undefined) sections.push("kitchen");
  if (patch.recipe_levels !== undefined || patch.favorite_recipes !== undefined) sections.push("recipes");
  if (patch.area_bonuses !== undefined) sections.push("areas");
  if (patch.sleep !== undefined) sections.push("sleep");
  return sections;
}

export function teamSavedProps(input: {
  kind: TeamSavedProps["kind"];
  slots: readonly Slot[];
  boxWrites: readonly BoxWrite[];
  island: string | null;
  islands: readonly Island[];
  meals: readonly (MealInput | null)[];
}): TeamSavedProps {
  const created = new Set(input.boxWrites.filter((w) => w.kind === "new").map((w) => w.entry.id));
  const entries = new Map(input.slots.flatMap((s) => s.entries).map((e) => [e.id, e]));
  const fromBox = [...entries.values()].filter((e) => e.sourceId && !created.has(e.id)).length;
  const island = input.island === null ? undefined : input.islands.find((i) => i.name === input.island);
  return {
    kind: input.kind,
    slots: input.slots.length,
    split_slots: input.slots.filter((s) => s.entries.length === 2).length,
    members_from_box: fromBox,
    members_created: created.size,
    has_map: input.island !== null,
    expert_map: island?.expert ?? false,
    meals: mealsCount(input.meals),
  };
}
