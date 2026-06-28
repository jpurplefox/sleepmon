// Espejo de sleepmon.domain.skills: data de las main skills que necesita el form
// para mostrar nombre + bajada real del juego según el nivel de skill.

import { MAX_SKILL_LEVEL } from "./constants";

// Ingredientes que entrega Ingredient Draw S por nivel de skill (1..7).
export const INGREDIENT_DRAW_AMOUNTS = [5, 6, 8, 11, 13, 16, 18];

export function drawsIngredients(mainSkill: string | undefined): boolean {
  // Reconoce la familia por prefijo: "Ingredient Draw S" y variantes con pasivo
  // ("(Super Luck)", "(Hyper Cutter)").
  return !!mainSkill && mainSkill.startsWith("Ingredient Draw S");
}

export function ingredientDrawAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1;
  return INGREDIENT_DRAW_AMOUNTS[i];
}

// Energía que Energy for Everyone S restaura a CADA compañero por nivel (1..6).
// E4E topa en nivel 6 (no tiene nivel 7).
export const ENERGY_FOR_EVERYONE_AMOUNTS = [5, 7, 9, 11, 15, 18];

export function restoresTeamEnergy(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Energy for Everyone S");
}

export function energyForEveryoneAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), ENERGY_FOR_EVERYONE_AMOUNTS.length) - 1;
  return ENERGY_FOR_EVERYONE_AMOUNTS[i];
}

// Ingredientes (de cualquier tipo, al azar) que consigue Ingredient Magnet S por
// nivel (1..7).
export const INGREDIENT_MAGNET_AMOUNTS = [6, 8, 11, 14, 17, 21, 24];

export function magnetsIngredients(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Ingredient Magnet S");
}

export function ingredientMagnetAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1;
  return INGREDIENT_MAGNET_AMOUNTS[i];
}

// Ingredientes extra de pote que da Cooking Power-Up S por nivel (1..7).
export const COOKING_POWER_UP_AMOUNTS = [7, 10, 12, 17, 22, 27, 31];

export function powersUpCooking(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Cooking Power-Up S");
}

export function cookingPowerUpAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1;
  return COOKING_POWER_UP_AMOUNTS[i];
}

// Charge Strength S / M: fuerza por nivel (1..7). S y M dan un monto fijo; S
// (Random) da un rango (min, max) uniforme; la variante Stockpile no se modela.
export const CHARGE_STRENGTH_S_AMOUNTS = [400, 569, 785, 1083, 1496, 2066, 3212];
export const CHARGE_STRENGTH_M_AMOUNTS = [880, 1251, 1726, 2383, 3290, 4546, 6858];
export const CHARGE_STRENGTH_S_RANDOM_RANGES: [number, number][] = [
  [200, 800],
  [285, 1138],
  [393, 1570],
  [542, 2166],
  [748, 2992],
  [1033, 4132],
  [1606, 6424],
];

const idx = (level: number) => Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1;

// Sinergia Plus/Minun (Plusle y Minun): tablas base propias + bonus que asumimos
// siempre activo (compañero Plus/Minus presente).
export const INGREDIENT_MAGNET_PLUS_BASE = [5, 7, 9, 11, 13, 16, 18];
export const INGREDIENT_MAGNET_PLUS_BONUS = [6, 7, 8, 9, 10, 11, 12];
export const COOKING_POWER_UP_MINUS_POT = [5, 7, 9, 12, 16, 20, 24];
export const COOKING_POWER_UP_MINUS_ENERGY = [8, 10, 13, 17, 23, 30, 35];

// Dream Shard Magnet S: fragmentos de sueño por nivel (1..8). Variante fija y otra
// S (Random) con rango (min, max). Llega a nivel 8.
export const DREAM_SHARD_MAGNET_S_AMOUNTS = [240, 340, 480, 670, 920, 1260, 1800, 2500];
export const DREAM_SHARD_MAGNET_S_RANDOM_RANGES: [number, number][] = [
  [120, 480],
  [170, 680],
  [240, 960],
  [335, 1340],
  [460, 1840],
  [630, 2520],
  [900, 3600],
  [1150, 4600],
];

const dsIdx = (level: number) =>
  Math.min(Math.max(level, 1), DREAM_SHARD_MAGNET_S_AMOUNTS.length) - 1;

export function magnetsDreamShards(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Dream Shard Magnet S");
}

// Tasty Chance S: aumento de Extra Tasty (en %) por nivel (1..6). Topa en nivel 6.
export const TASTY_CHANCE_S_AMOUNTS = [4, 5, 6, 7, 8, 10];

export function boostsTastyChance(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Tasty Chance S");
}

export function tastyChanceAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), TASTY_CHANCE_S_AMOUNTS.length) - 1;
  return TASTY_CHANCE_S_AMOUNTS[i];
}

// Extra Helpful S: multiplicador de ayuda (×N) por nivel (1..7).
export const EXTRA_HELPFUL_S_AMOUNTS = [6, 7, 8, 9, 10, 11, 12];

export function isExtraHelpful(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Extra Helpful S");
}

export function extraHelpfulAmount(level: number): number {
  return EXTRA_HELPFUL_S_AMOUNTS[idx(level)];
}

// Energizing Cheer S: energía a un compañero al azar por nivel (1..6). Topa en 6.
export const ENERGIZING_CHEER_S_AMOUNTS = [14, 17, 22, 28, 38, 50];

export function cheersRandomEnergy(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Energizing Cheer S");
}

export function energizingCheerAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), ENERGIZING_CHEER_S_AMOUNTS.length) - 1;
  return ENERGIZING_CHEER_S_AMOUNTS[i];
}

// Charge Energy S: energía al PROPIO Pokémon por nivel (1..6). Topa en nivel 6.
export const CHARGE_ENERGY_S_AMOUNTS = [12, 16, 21, 26, 33, 43];

export function chargesSelfEnergy(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Charge Energy S");
}

export function chargeEnergyAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), CHARGE_ENERGY_S_AMOUNTS.length) - 1;
  return CHARGE_ENERGY_S_AMOUNTS[i];
}

// Nivel máximo de la main skill (algunas topan en 6, otras en 7). Default 7.
export function maxSkillLevel(mainSkill: string | undefined): number {
  if (restoresTeamEnergy(mainSkill)) return ENERGY_FOR_EVERYONE_AMOUNTS.length; // E4E: 6
  if (chargesSelfEnergy(mainSkill)) return CHARGE_ENERGY_S_AMOUNTS.length; // Charge Energy: 6
  if (magnetsDreamShards(mainSkill)) return DREAM_SHARD_MAGNET_S_AMOUNTS.length; // Dream Shard: 8
  if (boostsTastyChance(mainSkill)) return TASTY_CHANCE_S_AMOUNTS.length; // Tasty Chance: 6
  if (cheersRandomEnergy(mainSkill)) return ENERGIZING_CHEER_S_AMOUNTS.length; // Energizing Cheer: 6
  return MAX_SKILL_LEVEL;
}

// Bajada real del juego para la skill, con la cantidad del nivel ya resuelta.
// null si no tenemos la descripción de esa skill todavía.
export function skillDescription(mainSkill: string | undefined, level: number): string | null {
  if (drawsIngredients(mainSkill)) {
    return `Gets ${ingredientDrawAmount(level)} of one type of ingredient chosen randomly from a specific selection of ingredients.`;
  }
  if (restoresTeamEnergy(mainSkill)) {
    return `Restores ${energyForEveryoneAmount(level)} Energy to each Pokémon on your team.`;
  }
  // Plusle / Minun: chequear las variantes Plus/Minus antes que las genéricas.
  if (mainSkill?.startsWith("Ingredient Magnet S (Plus)")) {
    return `Gets you ${INGREDIENT_MAGNET_PLUS_BASE[idx(level)]} ingredients at random, plus ${INGREDIENT_MAGNET_PLUS_BONUS[idx(level)]} more with a Plus/Minus partner.`;
  }
  if (magnetsIngredients(mainSkill)) {
    return `Gets you ${ingredientMagnetAmount(level)} ingredients chosen at random.`;
  }
  if (mainSkill?.startsWith("Cooking Power-Up S (Minus)")) {
    return `Pot room for ${COOKING_POWER_UP_MINUS_POT[idx(level)]} more ingredients, and restores ${COOKING_POWER_UP_MINUS_ENERGY[idx(level)]} Energy to a random teammate with a Plus/Minus partner.`;
  }
  if (powersUpCooking(mainSkill)) {
    return `Gives your pot room for ${cookingPowerUpAmount(level)} more ingredients the next time you cook.`;
  }
  // Charge Strength: el orden importa porque (Random)/(Stockpile) empiezan con "S".
  if (mainSkill?.startsWith("Charge Strength M")) {
    return `Increases Snorlax's Strength by ${CHARGE_STRENGTH_M_AMOUNTS[idx(level)].toLocaleString("en-US")}.`;
  }
  if (mainSkill?.startsWith("Charge Strength S (Random)")) {
    const [lo, hi] = CHARGE_STRENGTH_S_RANDOM_RANGES[idx(level)];
    return `Increases Snorlax's Strength by ${lo.toLocaleString("en-US")} to ${hi.toLocaleString("en-US")} at random.`;
  }
  if (mainSkill?.startsWith("Charge Strength S (Stockpile)")) {
    return null; // acumula; no la estimamos todavía
  }
  if (mainSkill?.startsWith("Charge Strength S")) {
    return `Increases Snorlax's Strength by ${CHARGE_STRENGTH_S_AMOUNTS[idx(level)].toLocaleString("en-US")}.`;
  }
  if (chargesSelfEnergy(mainSkill)) {
    return `Restores ${chargeEnergyAmount(level)} Energy to the user.`;
  }
  // Dream Shard Magnet: el orden importa porque (Random) empieza con el mismo prefijo.
  if (mainSkill?.startsWith("Dream Shard Magnet S (Random)")) {
    const [lo, hi] = DREAM_SHARD_MAGNET_S_RANDOM_RANGES[dsIdx(level)];
    return `Obtain ${lo.toLocaleString("en-US")} to ${hi.toLocaleString("en-US")} Dream Shards at random.`;
  }
  if (mainSkill?.startsWith("Dream Shard Magnet S")) {
    return `Obtain ${DREAM_SHARD_MAGNET_S_AMOUNTS[dsIdx(level)].toLocaleString("en-US")} Dream Shards.`;
  }
  if (boostsTastyChance(mainSkill)) {
    return `Raises your Extra Tasty rate by ${tastyChanceAmount(level)}% (stacks up to 70%).`;
  }
  if (isExtraHelpful(mainSkill)) {
    return `Instantly gets you ×${extraHelpfulAmount(level)} the usual help from a helper Pokémon.`;
  }
  if (cheersRandomEnergy(mainSkill)) {
    return `Restores ${energizingCheerAmount(level)} Energy to another Pokémon chosen at random.`;
  }
  return null;
}
