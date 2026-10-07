/**
 * Helpers para las recetas del juego.
 */
import type { MealInput, Recipe } from "./types";

/** The three dish types, in the display order used across recipe pickers. */
export const RECIPE_TYPES: Recipe["type"][] = ["Curry", "Salad", "Dessert"];

/** i18n key for a dish type's label, shared by every dish-type toggle. */
export function dishTypeLabelKey(type: Recipe["type"]): string {
  return type === "Curry"
    ? "teams.dishTypeCurry"
    : type === "Salad"
      ? "teams.dishTypeSalad"
      : "teams.dishTypeDessert";
}

/** The meals a dish type starts with: its favorite recipe in all three slots, or none. */
export function mealsForDishType(
  favorite: string | null,
  levelFor: (recipe: string) => number,
): (MealInput | null)[] {
  if (favorite === null) return [null, null, null];
  const level = levelFor(favorite);
  return [0, 1, 2].map(() => ({ recipe: favorite, level }));
}

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
