import type { BerryRole, WeeklyBonus } from "./types";

/** The five map assumptions Comparison offers (PRD 0002, "Map scenario"). */
export type Scenario =
  | "none"
  | "favorite"
  | "expert_berry"
  | "expert_ingredient"
  | "expert_skill";

export interface ScenarioOption {
  value: Scenario;
  labelKey: string;
  /** The selector's own mark; null for the neutral scenario. */
  mark: string | null;
}

// PRD order: from no effect to the biggest one. The marks keep the ES-style
// decimals that expertMarks.ts already renders in both languages, so the selector
// and the card read identically.
export const SCENARIOS: readonly ScenarioOption[] = [
  { value: "none", labelKey: "prod.scenarioNone", mark: null },
  { value: "favorite", labelKey: "prod.scenarioFavorite", mark: "×2" },
  { value: "expert_berry", labelKey: "prod.scenarioExpertBerry", mark: "×2,4" },
  { value: "expert_ingredient", labelKey: "prod.scenarioExpertIngredient", mark: "+1" },
  { value: "expert_skill", labelKey: "prod.scenarioExpertSkill", mark: "×1,25" },
];

export function scenarioOption(value: Scenario): ScenarioOption {
  return SCENARIOS.find((s) => s.value === value) ?? SCENARIOS[0];
}

const WEEKLY: Record<Scenario, WeeklyBonus> = {
  none: "berry_strength",
  favorite: "berry_strength",
  expert_berry: "berry_strength",
  expert_ingredient: "ingredient",
  expert_skill: "skill_trigger",
};

// Explicit like WEEKLY above, not a "expert_" prefix test: a future scenario named
// without that prefix must still declare its expert-ness here, in step with the backend.
const IS_EXPERT: Record<Scenario, boolean> = {
  none: false,
  favorite: false,
  expert_berry: true,
  expert_ingredient: true,
  expert_skill: true,
};

/**
 * The scenario in the mark vocabulary the card and `expertMarks` already speak.
 * Always "sub", never "main": a single berry is the main favorite, so its perks
 * can't apply to a whole comparison.
 */
export function scenarioCardProps(value: Scenario): {
  berryRole: BerryRole;
  expert: boolean;
  weeklyBonus: WeeklyBonus;
} {
  return {
    berryRole: value === "none" ? "none" : "sub",
    expert: IS_EXPERT[value],
    weeklyBonus: WEEKLY[value],
  };
}
