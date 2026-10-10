// Event bonus: the effect kinds, their limits (PRD 0012) and how the UI shows them.
import { GENERIC_BERRY_ICON, POT_EXPANSION_ICON } from "./skillIcons";
import type { Lang } from "./i18n/terms";

export type EventEffectKind =
  | "extra_ingredients"
  | "extra_berries"
  | "skill_ingredients"
  | "skill_trigger"
  | "skill_level"
  | "carry_limit"
  | "dish_strength"
  | "pot_size";

export type EventScope =
  | { kind: "team" }
  | { kind: "type"; type: string | null }
  | { kind: "specialty"; specialty: string };

export interface EventEffect {
  id: string;
  kind: EventEffectKind;
  value: number;
  scope: EventScope;
}

export interface KindSpec {
  additive: boolean;
  min: number;
  max: number;
  step: number;
  initial: number;
  scoped: boolean;
  icon: string;
  labelKey: string;
}

const plus = (max: number, icon: string, labelKey: string): KindSpec => ({
  additive: true,
  min: 1,
  max,
  step: 1,
  initial: 1,
  scoped: true,
  icon,
  labelKey,
});
const times = (icon: string, labelKey: string, scoped = true): KindSpec => ({
  additive: false,
  min: 1.05,
  max: 3,
  step: 0.05,
  initial: 1.5,
  scoped,
  icon,
  labelKey,
});

export const EVENT_KINDS: Record<EventEffectKind, KindSpec> = {
  extra_ingredients: plus(5, "/subskill/ingredient-finder.svg", "event.kind.extraIngredients"),
  extra_berries: plus(5, GENERIC_BERRY_ICON, "event.kind.extraBerries"),
  skill_ingredients: times("/nature/ingredient.png", "event.kind.skillIngredients"),
  skill_trigger: times("/subskill/skill-trigger.svg", "event.kind.skillTrigger"),
  skill_level: plus(5, "/subskill/skill-level-up.svg", "event.kind.skillLevel"),
  carry_limit: plus(50, "/subskill/inventory-up.svg", "event.kind.carryLimit"),
  dish_strength: times("/pot.webp", "event.kind.dishStrength", false),
  pot_size: times(POT_EXPANSION_ICON, "event.kind.potSize", false),
};

export const EVENT_KIND_ORDER = Object.keys(EVENT_KINDS) as EventEffectKind[];

export const SCOPE_SPECIALTIES = ["Berries", "Ingredients", "Skills"] as const;
export const SPECIALTY_ICON: Record<string, string> = {
  Berries: GENERIC_BERRY_ICON,
  Ingredients: "/nature/ingredient.png",
  Skills: "/nature/mainSkill.svg",
};

// Round to the step's precision so 1.15 + 0.05 is 1.2, not 1.2000000000000002.
const snap = (v: number) => Math.round(v * 100) / 100;

export function stepValue(kind: EventEffectKind, value: number, dir: 1 | -1): number {
  const spec = EVENT_KINDS[kind];
  return Math.min(spec.max, Math.max(spec.min, snap(value + dir * spec.step)));
}

export function atBound(kind: EventEffectKind, value: number, dir: 1 | -1): boolean {
  const spec = EVENT_KINDS[kind];
  return dir === 1 ? value >= spec.max : value <= spec.min;
}

export function formatEffectValue(kind: EventEffectKind, value: number, lang: Lang): string {
  if (EVENT_KINDS[kind].additive) return `+${value}`;
  const n = value.toLocaleString(lang === "es" ? "es-AR" : "en-US", { maximumFractionDigits: 2 });
  return `×${n}`;
}

export function isComplete(effect: Omit<EventEffect, "id">): boolean {
  return effect.scope.kind !== "type" || effect.scope.type !== null;
}

export interface EventEffectRequest {
  kind: EventEffectKind;
  value: number;
  scope: "team" | "type" | "specialty";
  target: string | null;
}

export function toRequest(effects: EventEffect[]): EventEffectRequest[] {
  return effects.map(({ kind, value, scope }) => ({
    kind,
    value,
    scope: scope.kind,
    target:
      scope.kind === "type"
        ? scope.type
        : scope.kind === "specialty"
          ? scope.specialty
          : null,
  }));
}
