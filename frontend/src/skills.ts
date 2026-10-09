// Espejo de sleepmon.domain.skills: data de las main skills que necesita el form
// para mostrar nombre + bajada real del juego según el nivel de skill.

import { MAX_SKILL_LEVEL } from "./constants";
import type { Lang } from "./i18n/terms";

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
// Lunar Blessing (Cresselia) has its own, smaller energy table, plus berries: own and
// per teammate when it's the team's only species with its berry (the floor).
export const ENERGY_FOR_EVERYONE_LUNAR_BLESSING_AMOUNTS = [3, 4, 5, 7, 9, 11];
const LUNAR_BLESSING_ALONE_OWN = [5, 9, 13, 17, 21, 25];

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
// Present (Delibird) has its own, smaller table.
export const INGREDIENT_MAGNET_PRESENT_AMOUNTS = [4, 6, 8, 10, 12, 15, 17];

export function magnetsIngredients(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Ingredient Magnet S");
}

export function ingredientMagnetAmount(level: number): number {
  const i = Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1;
  return INGREDIENT_MAGNET_AMOUNTS[i];
}

// La skill produce ingredientes (específicos o al azar): Ingredient Draw o Magnet.
// Usado por la cobertura de la Caja para que un especialista en Skills que junta
// ingredientes (Crustle, Plusle) cuente igual que un especialista en Ingredientes.
export function producesIngredients(mainSkill: string | undefined): boolean {
  return drawsIngredients(mainSkill) || magnetsIngredients(mainSkill);
}

// La skill cumple el rol de las bayas (darle Vigor a Snorlax o conseguir bayas):
// Charge Strength (S/M y variantes) o Berry Burst. Usado por la cobertura de
// bayas para incluir especialistas en Skills cuyo rol es ese (Noivern, Sceptile).
export function contributesBerryRole(mainSkill: string | undefined): boolean {
  return (
    !!mainSkill && (mainSkill.startsWith("Charge Strength") || mainSkill.startsWith("Berry Burst"))
  );
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
// (Random) da un rango (min, max) uniforme; Stockpile uses its average per trigger.
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
export const CHARGE_STRENGTH_S_STOCKPILE_AVERAGE = [600, 853, 1177, 1625, 2243, 3099, 4497];
// Bad Dreams (Darkrai): its own Charge Strength M table, plus 12 Energy off each
// non-Dark teammate per trigger.
export const BAD_DREAMS_STRENGTH = [2640, 3753, 5178, 7149, 9870, 13638, 18515];
export const BAD_DREAMS_ENERGY_DRAIN = 12;

const idx = (level: number) => Math.min(Math.max(level, 1), MAX_SKILL_LEVEL) - 1;

// Sinergia Plus/Minun (Plusle y Minun): tablas base propias + bonus que asumimos
// siempre activo (compañero Plus/Minus presente).
export const INGREDIENT_MAGNET_PLUS_BASE = [5, 7, 9, 11, 13, 16, 18];
export const INGREDIENT_MAGNET_PLUS_BONUS = [6, 7, 8, 9, 10, 11, 12];
export const COOKING_POWER_UP_MINUS_POT = [5, 7, 9, 12, 16, 20, 24];
export const COOKING_POWER_UP_MINUS_ENERGY = [8, 10, 13, 17, 23, 30, 35];

// Dream Shard Magnet S: fragmentos de sueño por nivel (1..8). Variante fija y otra
// S (Random) con rango (min, max). Llega a nivel 8. La variante S (Aura Sphere) gets the
// base shards plus Strength.
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

export const AURA_SPHERE_STRENGTH_AMOUNTS = [200, 285, 393, 542, 748, 1033, 1501, 2042];

// Cooking Assist S: random ingredients; Bulk Up also raises Extra Tasty (%) per trigger.
export const COOKING_ASSIST_S_INGREDIENTS = [6, 8, 11, 14, 17, 21, 24];
export const BULK_UP_TASTY_CHANCE_AMOUNTS = [1, 2, 2, 3, 3, 4, 5];

// Berry Zone (Psystrike), Mewtwo: Strength plus a Mago Berry boost (%). Caps at 6.
export const BERRY_ZONE_PSYSTRIKE_STRENGTH = [1408, 2002, 2762, 3813, 5264, 7274];
export const BERRY_ZONE_PSYSTRIKE_BOOST = [0.6, 0.8, 1, 1.2, 1.6, 2];

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
// Heal Pulse (Latias): energy to each of two teammates, plus ×N their help.
export const ENERGIZING_CHEER_HEAL_PULSE_AMOUNTS = [6, 8, 10, 13, 17, 22];
export const ENERGIZING_CHEER_HEAL_PULSE_HELPS = [1, 2, 2, 3, 4, 4];
// Nuzzle (Togedemaru) has its own, smaller energy table.
export const ENERGIZING_CHEER_NUZZLE_AMOUNTS = [9, 12, 16, 20, 27, 35];

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

// Berry Burst: own berries + N of each teammate's berry per trigger (1..6). Caps at 6.
export const BERRY_BURST_OWN = [11, 14, 21, 24, 27, 30];
export const BERRY_BURST_DISGUISE_OWN = [8, 10, 15, 17, 19, 21];
export const BERRY_BURST_PER_TEAMMATE = [1, 2, 2, 3, 4, 5];
// Draco Meteor alone (1 Dragon species, no Latias): the floor Comparison shows.
const DRACO_METEOR_ALONE: [number, number][] = [
  [12, 1], [21, 1], [29, 1], [38, 1], [43, 2], [48, 3],
];

export function burstsBerries(mainSkill: string | undefined): boolean {
  return !!mainSkill && mainSkill.startsWith("Berry Burst");
}

const bbIdx = (level: number) => Math.min(Math.max(level, 1), BERRY_BURST_OWN.length) - 1;

// Helper Boost (Raikou, Entei, Suicune): ×N helps from every member, alone (1..6).
export const HELPER_BOOST_HELPS = [2, 3, 3, 4, 4, 5];
// Moonlight (Umbreon): energy it may also give a teammate (half the time).
export const MOONLIGHT_SHARED_ENERGY = [6.3, 7.7, 10.1, 13.0, 17.2, 22.8];

// Nivel máximo de la main skill (algunas topan en 6, otras en 7). Default 7.
export function maxSkillLevel(mainSkill: string | undefined): number {
  if (mainSkill?.startsWith("Helper Boost")) return HELPER_BOOST_HELPS.length; // 6
  if (mainSkill?.startsWith("Berry Zone (Psystrike)")) return BERRY_ZONE_PSYSTRIKE_STRENGTH.length; // 6
  if (restoresTeamEnergy(mainSkill)) return ENERGY_FOR_EVERYONE_AMOUNTS.length; // E4E: 6
  if (chargesSelfEnergy(mainSkill)) return CHARGE_ENERGY_S_AMOUNTS.length; // Charge Energy: 6
  if (magnetsDreamShards(mainSkill)) return DREAM_SHARD_MAGNET_S_AMOUNTS.length; // Dream Shard: 8
  if (boostsTastyChance(mainSkill)) return TASTY_CHANCE_S_AMOUNTS.length; // Tasty Chance: 6
  if (cheersRandomEnergy(mainSkill)) return ENERGIZING_CHEER_S_AMOUNTS.length; // Energizing Cheer: 6
  if (burstsBerries(mainSkill)) return BERRY_BURST_OWN.length; // Berry Burst: 6
  return MAX_SKILL_LEVEL;
}

// Bajada de la skill, con la cantidad del nivel ya resuelta, en el idioma pedido.
// Usa los términos oficiales del juego (Vigor, Fragmentos de sueño, Plato riquísimo…).
// null si no tenemos la descripción de esa skill todavía.
export function skillDescription(
  mainSkill: string | undefined,
  level: number,
  lang: Lang,
): string | null {
  const es = lang === "es";
  const num = (n: number) => n.toLocaleString(es ? "es-ES" : "en-US");

  if (drawsIngredients(mainSkill)) {
    const x = ingredientDrawAmount(level);
    const base = es
      ? `Consigue ${x} de un tipo de ingrediente elegido al azar de una selección concreta.`
      : `Gets ${x} of one type of ingredient chosen randomly from a specific selection of ingredients.`;
    if (mainSkill!.startsWith("Ingredient Draw S (Super Luck)"))
      return es
        ? `${base} En raras ocasiones, consigue muchos Fragmentos de sueño en su lugar.`
        : `${base} On rare occasions, gets a great number of Dream Shards instead.`;
    if (mainSkill!.startsWith("Ingredient Draw S (Hyper Cutter)"))
      return es
        ? `${base} A veces consigue ${x} ingredientes más.`
        : `${base} Sometimes gets an additional ${x} ingredients.`;
    return base;
  }
  if (mainSkill?.startsWith("Energy for Everyone S (Lunar Blessing)")) {
    const table = ENERGY_FOR_EVERYONE_LUNAR_BLESSING_AMOUNTS;
    const i = Math.min(Math.max(level, 1), table.length) - 1;
    const own = LUNAR_BLESSING_ALONE_OWN[i];
    return es
      ? `Restaura ${table[i]} de Energía a cada Pokémon del equipo, y consigue ${own} bayas más 1 de cada una de las bayas que recolectan los demás. Más con más especies de su misma baya en el equipo.`
      : `Restores ${table[i]} Energy to each Pokémon on your team, and gets ${own} Berries plus 1 of each of the Berries other Pokémon on your team collect. More with more species sharing its Berry on the team.`;
  }
  if (restoresTeamEnergy(mainSkill)) {
    const n = energyForEveryoneAmount(level);
    const base = es
      ? `Restaura ${n} de Energía a cada Pokémon del equipo.`
      : `Restores ${n} Energy to each Pokémon on your team.`;
    if (mainSkill!.startsWith("Energy for Everyone S (Berry Juice)"))
      return es ? `${base} A veces consigue además un Zumo de baya.` : `${base} Sometimes also gets a Berry Juice.`;
    return base;
  }
  // Plusle / Minun: chequear las variantes Plus/Minus antes que las genéricas.
  if (mainSkill?.startsWith("Ingredient Magnet S (Plus)")) {
    const base = INGREDIENT_MAGNET_PLUS_BASE[idx(level)];
    const bonus = INGREDIENT_MAGNET_PLUS_BONUS[idx(level)];
    return es
      ? `Te consigue ${base} ingredientes al azar, y ${bonus} más con un compañero Más/Menos.`
      : `Gets you ${base} ingredients at random, plus ${bonus} more with a Plus/Minus partner.`;
  }
  if (mainSkill?.startsWith("Ingredient Magnet S (Present)")) {
    const n = INGREDIENT_MAGNET_PRESENT_AMOUNTS[idx(level)];
    return es
      ? `Te consigue ${n} ingredientes al azar. A veces consigue además 4 caramelos para un Pokémon del equipo.`
      : `Gets you ${n} ingredients chosen at random. Sometimes also gets 4 candy for one Pokémon on your team.`;
  }
  if (magnetsIngredients(mainSkill)) {
    const n = ingredientMagnetAmount(level);
    return es
      ? `Te consigue ${n} ingredientes al azar.`
      : `Gets you ${n} ingredients chosen at random.`;
  }
  if (mainSkill?.startsWith("Cooking Power-Up S (Minus)")) {
    const pot = COOKING_POWER_UP_MINUS_POT[idx(level)];
    const energy = COOKING_POWER_UP_MINUS_ENERGY[idx(level)];
    return es
      ? `Amplía la olla en ${pot} ingredientes, y restaura ${energy} de Energía a un compañero al azar con un compañero Más/Menos.`
      : `Pot room for ${pot} more ingredients, and restores ${energy} Energy to a random teammate with a Plus/Minus partner.`;
  }
  if (powersUpCooking(mainSkill)) {
    const n = cookingPowerUpAmount(level);
    return es
      ? `Amplía la capacidad de la olla en ${n} ingredientes la próxima vez que cocines.`
      : `Gives your pot room for ${n} more ingredients the next time you cook.`;
  }
  // Charge Strength: el orden importa porque (Random)/(Stockpile) empiezan con "S".
  if (mainSkill?.startsWith("Charge Strength M (Bad Dreams)")) {
    const n = num(BAD_DREAMS_STRENGTH[idx(level)]);
    const drain = BAD_DREAMS_ENERGY_DRAIN;
    return es
      ? `Aumenta el Vigor de Snorlax en ${n} y reduce en ${drain} la Energía de cada compañero que no sea de tipo Siniestro.`
      : `Increases Snorlax's Strength by ${n} and lowers the Energy of each non-Dark-type teammate by ${drain}.`;
  }
  if (mainSkill?.startsWith("Charge Strength M")) {
    const n = num(CHARGE_STRENGTH_M_AMOUNTS[idx(level)]);
    return es ? `Aumenta el Vigor de Snorlax en ${n}.` : `Increases Snorlax's Strength by ${n}.`;
  }
  if (mainSkill?.startsWith("Charge Strength S (Random)")) {
    const [lo, hi] = CHARGE_STRENGTH_S_RANDOM_RANGES[idx(level)];
    return es
      ? `Aumenta el Vigor de Snorlax entre ${num(lo)} y ${num(hi)} al azar.`
      : `Increases Snorlax's Strength by ${num(lo)} to ${num(hi)} at random.`;
  }
  if (mainSkill?.startsWith("Charge Strength S (Stockpile)")) {
    const n = num(CHARGE_STRENGTH_S_STOCKPILE_AVERAGE[idx(level)]);
    return es
      ? `Elige Reserva o Escupir. Escupir le da Vigor a Snorlax según lo acumulado: unos ${n} por disparo en promedio.`
      : `Chooses Stockpile or Spit Up. Spit Up gives Snorlax Strength based on what was stockpiled: about ${n} per trigger on average.`;
  }
  if (mainSkill?.startsWith("Charge Strength S")) {
    const n = num(CHARGE_STRENGTH_S_AMOUNTS[idx(level)]);
    return es ? `Aumenta el Vigor de Snorlax en ${n}.` : `Increases Snorlax's Strength by ${n}.`;
  }
  if (mainSkill?.startsWith("Helper Boost")) {
    const n = HELPER_BOOST_HELPS[Math.min(Math.max(level, 1), HELPER_BOOST_HELPS.length) - 1];
    return es
      ? `Consigue al instante ×${n} la ayuda habitual de todos los Pokémon del equipo. Más con más especies de su misma baya en el equipo.`
      : `Instantly gets you ×${n} the usual help from all Pokémon on your team. More with more species sharing its Berry on the team.`;
  }
  if (mainSkill?.startsWith("Charge Energy S (Moonlight)")) {
    const n = chargeEnergyAmount(level);
    const table = MOONLIGHT_SHARED_ENERGY;
    const shared = num(table[Math.min(Math.max(level, 1), table.length) - 1]);
    return es
      ? `Restaura ${n} de Energía al usuario. A veces restaura además ${shared} de Energía a otro Pokémon.`
      : `Restores ${n} Energy to the user. Sometimes also restores ${shared} Energy to another Pokémon.`;
  }
  if (chargesSelfEnergy(mainSkill)) {
    const n = chargeEnergyAmount(level);
    return es
      ? `Restaura ${n} de Energía al usuario.`
      : `Restores ${n} Energy to the user.`;
  }
  // Dream Shard Magnet: el orden importa porque las variantes empiezan con el mismo
  // prefijo que la base.
  if (mainSkill?.startsWith("Dream Shard Magnet S (Aura Sphere)")) {
    const n = num(DREAM_SHARD_MAGNET_S_AMOUNTS[dsIdx(level)]);
    const strength = num(AURA_SPHERE_STRENGTH_AMOUNTS[dsIdx(level)]);
    return es
      ? `Obtén ${n} Fragmentos de sueño. Además aumenta el Vigor de Snorlax en ${strength}.`
      : `Obtain ${n} Dream Shards. Also increases Snorlax's Strength by ${strength}.`;
  }
  if (mainSkill?.startsWith("Dream Shard Magnet S (Random)")) {
    const [lo, hi] = DREAM_SHARD_MAGNET_S_RANDOM_RANGES[dsIdx(level)];
    return es
      ? `Obtén entre ${num(lo)} y ${num(hi)} Fragmentos de sueño al azar.`
      : `Obtain ${num(lo)} to ${num(hi)} Dream Shards at random.`;
  }
  if (mainSkill?.startsWith("Dream Shard Magnet S")) {
    const n = num(DREAM_SHARD_MAGNET_S_AMOUNTS[dsIdx(level)]);
    return es ? `Obtén ${n} Fragmentos de sueño.` : `Obtain ${n} Dream Shards.`;
  }
  if (mainSkill?.startsWith("Cooking Assist S")) {
    const n = COOKING_ASSIST_S_INGREDIENTS[idx(level)];
    if (!mainSkill.startsWith("Cooking Assist S (Bulk Up)"))
      return es ? `Te consigue ${n} ingredientes al azar.` : `Gets you ${n} ingredients chosen at random.`;
    const p = BULK_UP_TASTY_CHANCE_AMOUNTS[idx(level)];
    return es
      ? `Te consigue ${n} ingredientes al azar. Además aumenta la probabilidad de Plato riquísimo un ${p}% hasta que cocines un Plato riquísimo o cambies de zona.`
      : `Gets you ${n} ingredients chosen at random. Also raises your Extra Tasty rate by ${p}% until you cook an Extra Tasty dish or change sites.`;
  }
  if (mainSkill?.startsWith("Berry Zone (Psystrike)")) {
    const i = Math.min(Math.max(level, 1), BERRY_ZONE_PSYSTRIKE_STRENGTH.length) - 1;
    const n = num(BERRY_ZONE_PSYSTRIKE_STRENGTH[i]);
    const boost = num(BERRY_ZONE_PSYSTRIKE_BOOST[i]);
    return es
      ? `Aumenta el Vigor de Snorlax en ${n} y la fuerza de las bayas Ango un ${boost}%, hasta un 24%, hasta que cambies de zona.`
      : `Increases Snorlax's Strength by ${n} and Mago Berry strength by ${boost}%, up to 24%, until you change sites.`;
  }
  if (boostsTastyChance(mainSkill)) {
    const n = tastyChanceAmount(level);
    return es
      ? `Aumenta la probabilidad de Plato riquísimo un ${n}% (acumulable hasta 70%).`
      : `Raises your Extra Tasty rate by ${n}% (stacks up to 70%).`;
  }
  if (isExtraHelpful(mainSkill)) {
    const n = extraHelpfulAmount(level);
    return es
      ? `Consigue al instante ×${n} la ayuda habitual de un Pokémon ayudante.`
      : `Instantly gets you ×${n} the usual help from a helper Pokémon.`;
  }
  if (mainSkill?.startsWith("Energizing Cheer S (Heal Pulse)")) {
    const i = Math.min(Math.max(level, 1), ENERGIZING_CHEER_HEAL_PULSE_AMOUNTS.length) - 1;
    const n = ENERGIZING_CHEER_HEAL_PULSE_AMOUNTS[i];
    const helps = ENERGIZING_CHEER_HEAL_PULSE_HELPS[i];
    return es
      ? `Restaura ${n} de Energía a dos Pokémon del equipo elegidos al azar y consigue al instante ×${helps} la ayuda habitual de esos Pokémon. Más con Latios en el equipo.`
      : `Restores ${n} Energy to two random Pokémon on your team and instantly gets you ×${helps} the usual help from those Pokémon. More with Latios on the team.`;
  }
  if (mainSkill?.startsWith("Energizing Cheer S (Nuzzle)")) {
    const table = ENERGIZING_CHEER_NUZZLE_AMOUNTS;
    const n = table[Math.min(Math.max(level, 1), table.length) - 1];
    return es
      ? `Restaura ${n} de Energía a un Pokémon del equipo elegido al azar. Con suerte, ese Pokémon también recibe un bonus de activación de la habilidad principal.`
      : `Restores ${n} Energy to one random Pokémon on your team. If you're lucky, that Pokémon also gets a main skill activation bonus.`;
  }
  if (cheersRandomEnergy(mainSkill)) {
    const n = energizingCheerAmount(level);
    return es
      ? `Restaura ${n} de Energía a otro Pokémon elegido al azar.`
      : `Restores ${n} Energy to another Pokémon chosen at random.`;
  }
  if (burstsBerries(mainSkill)) {
    const i = bbIdx(level);
    const draco = mainSkill!.startsWith("Berry Burst (Draco Meteor)");
    const disguise = mainSkill!.startsWith("Berry Burst (Disguise)");
    const [own, each] = draco
      ? DRACO_METEOR_ALONE[i]
      : [(disguise ? BERRY_BURST_DISGUISE_OWN : BERRY_BURST_OWN)[i], BERRY_BURST_PER_TEAMMATE[i]];
    const base = es
      ? `Consigue ${own} bayas, más ${each} de cada una de las bayas que recolectan los demás Pokémon del equipo.`
      : `Gets ${own} Berries plus ${each} of each of the Berries other Pokémon on your team collect.`;
    if (disguise)
      return es
        ? `${base} Una vez por día, un Gran Éxito lo triplica.`
        : `${base} Once a day, a Great Success triples it.`;
    if (draco)
      return es
        ? `${base} Más con más especies Dragón y con Latias en el equipo.`
        : `${base} More with more Dragon species and with Latias on the team.`;
    return base;
  }
  return null;
}

// Skills whose production isn't (fully) calculated: the i18n key of the card's warning,
// or null when everything the skill does is modeled.
export function unmodeledSkillKey(mainSkill: string | undefined): string | null {
  if (!mainSkill) return null;
  if (mainSkill.startsWith("Metronome") || mainSkill.startsWith("Skill Copy")) {
    return "card.unmodeledSkill";
  }
  if (mainSkill.startsWith("Berry Zone (Psystrike)")) return "card.unmodeledBerryZone";
  if (mainSkill.startsWith("Energizing Cheer S (Nuzzle)")) return "card.unmodeledNuzzle";
  return null;
}
