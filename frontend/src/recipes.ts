/**
 * Helpers para las recetas del juego.
 */

/**
 * Slug de la imagen de una receta: baja los acentos, quita todo lo que no sea
 * letra o dígito, todo en minúsculas.
 * Ej: "Clodsire Éclair" → "clodsireeclair", `"Overgrow" Avocado Gratin` → "overgrowavocadogratin".
 */
export function recipeImage(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `/recipes/${slug}.png`;
}

/**
 * Fuerza de una receta a un nivel dado, aplicando el multiplicador del catálogo.
 * Clamp: level se acota a [1, levelBonus.length].
 */
export function recipeStrengthAtLevel(
  baseStrength: number,
  level: number,
  levelBonus: number[],
): number {
  const clamped = Math.max(1, Math.min(level, levelBonus.length));
  return Math.round(baseStrength * levelBonus[clamped - 1]);
}
