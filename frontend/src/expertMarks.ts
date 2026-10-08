import type { BerryRole, ExpertSpeed, WeeklyBonus } from "./types";

/** An annotation attached to a card metric: what the map does to that number. */
export interface MetricMark {
  metric: "cadence" | "berries" | "ingredients" | "skill";
  label: string;
  tone: "good" | "bad";
  /** Full effect text, used for the title and aria-label. */
  effect: string;
}

interface Args {
  role: BerryRole;
  expert: boolean;
  weeklyBonus: WeeklyBonus;
  /** The expert map's speed factors; defaults to Greengrass Isle (Expert)'s. */
  speed?: ExpertSpeed | null;
  /** The member's own skill level. */
  skillLevel: number;
  /** Level the domain actually used (already capped at the skill's max). */
  effectiveSkillLevel: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const BASE_EXPERT_SPEED: ExpertSpeed = { main: 0.9, penalty: 1.15 };

/** A help-interval factor as a whole percentage, e.g. 0.8 -> 20, 1.35 -> 35. */
const pct = (factor: number) => Math.round(Math.abs(1 - factor) * 100);

/** A map's cadence effects as marks, e.g. { main: "−20%", penalty: "+35%" }. */
export function speedLabels(speed: ExpertSpeed | null): { main: string; penalty: string } {
  const { main, penalty } = speed ?? BASE_EXPERT_SPEED;
  return { main: `−${pct(main)}%`, penalty: `+${pct(penalty)}%` };
}

/**
 * Marks for a member based on its berry and the current map (max four).
 * Normal map: just the x2 favorite, as before. Expert map: one mark per active
 * effect, plus the berry doubling that always applies to a favorite (main or sub).
 */
export function expertMarks({
  role,
  expert,
  weeklyBonus,
  speed,
  skillLevel,
  effectiveSkillLevel,
  t,
}: Args): MetricMark[] {
  if (!expert) {
    return role === "none"
      ? []
      : [
          {
            metric: "berries",
            label: "×2",
            tone: "good",
            effect: t("card.expertFavorite"),
          },
        ];
  }

  const resolved = speed ?? BASE_EXPERT_SPEED;
  const { main, penalty } = resolved;
  const labels = speedLabels(resolved);

  if (role === "none") {
    return [
      {
        metric: "cadence",
        label: labels.penalty,
        tone: "bad",
        effect: t("card.expertPenalty", { pct: pct(penalty) }),
      },
    ];
  }

  const marks: MetricMark[] = [];

  if (role === "main") {
    marks.push({
      metric: "cadence",
      label: labels.main,
      tone: "good",
      effect: t("card.expertMainSpeed", { pct: pct(main) }),
    });
    // Only if the +1 actually applied: a Pokemon already at its skill cap gains nothing.
    if (effectiveSkillLevel > skillLevel) {
      marks.push({
        metric: "skill",
        label: "Skill +1",
        tone: "good",
        effect: t("card.expertSkillLevel"),
      });
    }
  }

  // A favorite berry (main or sub) always doubles the berry strength; the weekly
  // berry-strength bonus replaces that plain ×2 with ×2.4 (it doesn't stack).
  if (weeklyBonus === "berry_strength") {
    marks.push({
      metric: "berries",
      label: "×2,4",
      tone: "good",
      effect: t("card.expertBerryStrength"),
    });
  } else {
    marks.push({
      metric: "berries",
      label: "×2",
      tone: "good",
      effect: t("card.expertFavorite"),
    });
  }

  if (weeklyBonus === "ingredient") {
    marks.push({
      metric: "ingredients",
      label: "+1",
      tone: "good",
      effect: t("card.expertIngredient"),
    });
  } else if (weeklyBonus === "skill_trigger") {
    marks.push({
      metric: "skill",
      label: "×1,25",
      tone: "good",
      effect: t("card.expertSkillTrigger"),
    });
  }

  return marks;
}
