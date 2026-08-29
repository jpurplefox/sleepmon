import type { BerryRole, WeeklyBonus } from "./types";

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
  /** The member's own skill level. */
  skillLevel: number;
  /** Level the domain actually used (already capped at the skill's max). */
  effectiveSkillLevel: number;
  t: (key: string) => string;
}

/**
 * Marks for a member based on its berry and the current map (max three).
 * Normal map: just the x2 favorite, as before. Expert map: one mark per active effect.
 */
export function expertMarks({
  role,
  expert,
  weeklyBonus,
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

  if (role === "none") {
    return [
      {
        metric: "cadence",
        label: "+15%",
        tone: "bad",
        effect: t("card.expertPenalty"),
      },
    ];
  }

  const marks: MetricMark[] = [];

  if (role === "main") {
    marks.push({
      metric: "cadence",
      label: "−10%",
      tone: "good",
      effect: t("card.expertMainSpeed"),
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

  if (weeklyBonus === "berry_strength") {
    marks.push({
      metric: "berries",
      label: "×2,4",
      tone: "good",
      effect: t("card.expertBerryStrength"),
    });
  } else if (weeklyBonus === "ingredient") {
    marks.push({
      metric: "ingredients",
      label: "+1",
      tone: "good",
      effect: t("card.expertIngredient"),
    });
  } else {
    marks.push({
      metric: "skill",
      label: "×1,25",
      tone: "good",
      effect: t("card.expertSkillTrigger"),
    });
  }

  return marks;
}
