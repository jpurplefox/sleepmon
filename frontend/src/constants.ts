// Reglas de desbloqueo espejo del dominio (sleepmon.domain.catalog_data).
// Sirven para que el formulario muestre la cantidad correcta de slots según nivel.

export const SUB_SKILL_UNLOCK_LEVELS = [10, 25, 50, 70, 80];
export const INGREDIENT_UNLOCK_LEVELS = [1, 30, 60];
export const MAX_LEVEL = 100;

export function maxIngredientSlots(level: number): number {
  return INGREDIENT_UNLOCK_LEVELS.filter((l) => level >= l).length;
}

export function maxSubSkillSlots(level: number): number {
  return SUB_SKILL_UNLOCK_LEVELS.filter((l) => level >= l).length;
}
