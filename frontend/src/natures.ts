// Metadatos de los 5 stats que una naturaleza puede subir/bajar. La clave es el
// valor exacto que manda el backend (NatureStat: "Speed of Help", etc.).
// Los íconos son los mismos que usa RaenonX (public/images/generic), servidos
// desde /public/nature.
export interface NatureStatMeta {
  icon: string; // nombre del archivo en /public/nature
  label: string; // nombre legible (es) para tooltips y títulos de grupo
}

export const NATURE_STATS: Record<string, NatureStatMeta> = {
  "Energy Recovery": { icon: "mood", label: "Recuperación de energía" },
  "EXP Gains": { icon: "exp", label: "Ganancia de EXP" },
  "Speed of Help": { icon: "speed", label: "Velocidad de ayuda" },
  "Main Skill Chance": { icon: "mainSkill", label: "Prob. de skill principal" },
  "Ingredient Finding": { icon: "ingredient", label: "Búsqueda de ingredientes" },
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
  return `/nature/${NATURE_STATS[stat]?.icon ?? "exp"}.png`;
}

export function statLabel(stat: string | null): string {
  if (!stat) return "Sin efecto";
  return NATURE_STATS[stat]?.label ?? stat;
}
