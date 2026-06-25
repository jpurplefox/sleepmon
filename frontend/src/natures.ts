// Metadatos de los 5 stats que una naturaleza puede subir/bajar. La clave es el
// valor exacto que manda el backend (NatureStat: "Speed of Help", etc.).
export interface NatureStatMeta {
  glyph: string; // símbolo corto para los badges del selector
  label: string; // nombre legible (es) para tooltips
}

export const NATURE_STATS: Record<string, NatureStatMeta> = {
  "Energy Recovery": { glyph: "☺", label: "Recuperación de energía" },
  "EXP Gains": { glyph: "EXP", label: "Ganancia de EXP" },
  "Speed of Help": { glyph: "≫", label: "Velocidad de ayuda" },
  "Main Skill Chance": { glyph: "⚡", label: "Prob. de skill principal" },
  "Ingredient Finding": { glyph: "🍎", label: "Búsqueda de ingredientes" },
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

export function statGlyph(stat: string | null): string {
  if (!stat) return "⊗";
  return NATURE_STATS[stat]?.glyph ?? stat;
}

export function statLabel(stat: string | null): string {
  if (!stat) return "Sin efecto";
  return NATURE_STATS[stat]?.label ?? stat;
}
