import type { BerryRole, WeeklyBonus } from "./types";

/** Una anotación pegada a una métrica de la card: qué le hace el mapa a ese número. */
export interface MetricMark {
  metric: "cadence" | "berries" | "ingredients" | "skill";
  label: string;
  tone: "good" | "bad";
  /** Texto completo del efecto, para title y aria-label. */
  effect: string;
}

interface Args {
  role: BerryRole;
  expert: boolean;
  weeklyBonus: WeeklyBonus;
  /** Nivel de skill del propio miembro. */
  skillLevel: number;
  /** Nivel con el que el dominio calculó (ya saturado por el tope de la skill). */
  effectiveSkillLevel: number;
  t: (key: string) => string;
}

/**
 * Las marcas que corresponden a un miembro según su baya y el mapa.
 *
 * En un mapa normal, como mucho el ×2 de favorita — igual que hoy. En uno experto,
 * cada efecto se marca sobre la métrica que cambia, con un máximo de tres.
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
    // Solo si el +1 realmente aplicó: un Pokémon ya al tope de su skill no gana nada.
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
