// Reglas de desbloqueo espejo del dominio (sleepmon.domain.catalog_data).
// Sirven para que el formulario muestre la cantidad correcta de slots según nivel.

export const SUB_SKILL_UNLOCK_LEVELS = [10, 25, 50, 70, 80];
export const INGREDIENT_UNLOCK_LEVELS = [1, 30, 60];
export const MAX_LEVEL = 100;
// Nivel máximo de una main skill (espejo de sleepmon.domain.catalog_data).
export const MAX_SKILL_LEVEL = 7;

// Fallback de nivel de desbloqueo para slots de sub skill fuera de los 5 conocidos:
// un slot inexistente nunca se desbloquea. Evita mostrar un "nivel 999" mágico.
export const SUB_SKILL_NEVER_UNLOCKS = Infinity;

// Listones por horas de sueño acumuladas (espejo de sleepmon.domain.value_objects
// Ribbon + catalog_data). `name` es el valor que viaja al backend ("" = sin listón).
// Los bonos son ACUMULATIVOS: cada listón implica los anteriores. `inventoryBonus`
// es el total acumulado (+1, +1+2, +1+2+3, +1+2+3+2); `speed` indica si a esa altura
// hay bonus de velocidad acumulado (desde 500h). El backend calcula el % exacto según
// las evoluciones de la línea.
export interface RibbonTier {
  name: string;
  hours: number;
  inventoryBonus: number;
  speed: boolean;
}

export const RIBBONS: RibbonTier[] = [
  { name: "", hours: 0, inventoryBonus: 0, speed: false },
  { name: "200h", hours: 200, inventoryBonus: 1, speed: false },
  { name: "500h", hours: 500, inventoryBonus: 3, speed: true },
  { name: "1000h", hours: 1000, inventoryBonus: 6, speed: true },
  { name: "2000h", hours: 2000, inventoryBonus: 8, speed: true },
];

// Niveles "principales" para los shortcuts del selector: la unión de los niveles
// donde se desbloquea algo (ingredientes 1/30/60 + sub skills 10/25/50/70/80).
export const LEVEL_SHORTCUTS = [
  ...new Set([...INGREDIENT_UNLOCK_LEVELS, ...SUB_SKILL_UNLOCK_LEVELS]),
].sort((a, b) => a - b);

export function maxIngredientSlots(level: number): number {
  return INGREDIENT_UNLOCK_LEVELS.filter((l) => level >= l).length;
}

export function maxSubSkillSlots(level: number): number {
  return SUB_SKILL_UNLOCK_LEVELS.filter((l) => level >= l).length;
}
