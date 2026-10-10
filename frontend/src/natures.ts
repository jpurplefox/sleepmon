// Metadatos de los 5 stats que una naturaleza puede subir/bajar. La clave es el
// valor exacto que manda el backend (NatureStat: "Speed of Help", etc.).
// Icons are served from /public/nature: the game's own for energy and
// ingredients, and our glyphs (scripts/icons.py) for EXP, main skill and help speed.
export interface NatureStatMeta {
  icon: string; // file name in /public/nature
  label: string; // nombre legible (es) para tooltips y títulos de grupo
}

export const NATURE_STATS: Record<string, NatureStatMeta> = {
  "Energy Recovery": { icon: "mood.png", label: "Recuperación de energía" },
  "EXP Gains": { icon: "exp.svg", label: "Ganancia de EXP" },
  "Speed of Help": { icon: "speed.svg", label: "Velocidad de ayuda" },
  "Main Skill Chance": { icon: "mainSkill.svg", label: "Prob. de skill principal" },
  "Ingredient Finding": { icon: "ingredient.png", label: "Búsqueda de ingredientes" },
};

// Orden de los grupos en el selector (por stat que la naturaleza *sube*), igual
// que RaenonX. Las neutras van primero, sin título.
export const NATURE_GROUP_ORDER = [
  "Energy Recovery",
  "EXP Gains",
  "Speed of Help",
  "Main Skill Chance",
  "Ingredient Finding",
];

export function statIcon(stat: string): string {
  return `/nature/${NATURE_STATS[stat]?.icon ?? "exp.svg"}`;
}

export function statLabel(stat: string | null): string {
  if (!stat) return "Sin efecto";
  return NATURE_STATS[stat]?.label ?? stat;
}
