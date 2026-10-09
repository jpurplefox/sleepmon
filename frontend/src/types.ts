// Tipos espejo de los schemas del backend (sleepmon.adapters.inbound.http.schemas).

import type { EventEffectRequest } from "./eventBonus";

export interface Nature {
  name: string;
  neutral: boolean;
  increased: string | null;
  decreased: string | null;
}

export interface SubSkill {
  name: string;
  tier: "Gold" | "Blue" | "Regular";
}

export interface Species {
  name: string;
  dex: number;
  specialty: string;
  berry: string;
  // Tipo elemental (1:1 con la baya); habilita filtrar por tipo en la Caja.
  type: string;
  sleep_type: string;
  main_skill: string;
  ingredient_slots: string[][];
  // Cantidad por slot y por ingrediente, alineada con ingredient_slots:
  // ingredient_amounts[slot][j] = cantidad de ingredient_slots[slot][j].
  ingredient_amounts: number[][];
  base_inventory: number;
}

export type RatingTier = "basic" | "great" | "ultra" | "master";

export interface Rating {
  tier: RatingTier;
  level: number;
  required_strength: number;
}

export interface Island {
  name: string;
  // Bayas que el juego establece como favoritas para esta isla (vacío si la isla
  // permite elegir libremente, i.e. user_picks == true).
  favorite_berries: string[];
  // true = el jugador elige las bayas favoritas (Greengrass Isle).
  user_picks: boolean;
  // Los 35 ratings de Snorlax de la isla (Basic1..Master20), ascendentes por fuerza.
  ratings: Rating[];
  // true = expert-mode area: splits favorites into main and sub-favorites and
  // applies the four PRD 0007 effects.
  expert: boolean;
  // Expert map's help-interval factors (main berry, no favorite); null elsewhere.
  expert_speed: ExpertSpeed | null;
}

export interface ExpertSpeed {
  main: number;
  penalty: number;
}

export type WeeklyBonus = "berry_strength" | "ingredient" | "skill_trigger";
export type BerryRole = "main" | "sub" | "none";

export interface Catalog {
  natures: Nature[];
  sub_skills: SubSkill[];
  ingredients: string[];
  species: Species[];
  // Multiplicador de fuerza de una receta por nivel (longitud 70, índice = nivel-1).
  // recipe_level_bonus[0] == 1.0 (nivel 1, sin bonus).
  recipe_level_bonus: number[];
  // Fuerza base de cada ingrediente (a nivel 1); 19 entradas, una por ingrediente.
  // Usada por el frontend para estimar la fuerza de los fillers en una receta.
  ingredient_strengths: Record<string, number>;
  // Las 8 islas del juego con sus bayas favoritas configuradas.
  islands: Island[];
  pot_ladder: number[];
}

export interface BerryYield {
  berry: string;
  amount: number;
  strength: number;
}

export interface BerrySource {
  kind: "helps" | "skill";
  member_id: string | null;
  species: string | null;
  amount: number;
  strength_base: number;
}

export interface TeamBerryRow {
  berry: string;
  amount: number;
  strength: number;
  strength_base: number;
  sources: BerrySource[];
}

// Invariantes del contrato del backend (ver MemberInput):
//  - ingredients: EXACTAMENTE 3, uno por slot (el backend rechaza con 400 != 3).
//  - sub_skills: hasta 5, sin repetir.
//  - nature / ribbon: opcionales; "" significa "ninguno".
//  - level: entero 1..100.
// Producción diaria resumida de un miembro, para el overview de la Caja. Viene en
// el listado (/team); ausente en respuestas de un solo miembro.
export interface MemberProduction {
  berries: number;
  // Fuerza/día DIRECTA de las bayas (bayas × fuerza por baya del nivel).
  berry_strength: number;
  ingredients: SlotProduction[];
  ingredients_total: number;
  skill_triggers: number;
  // Ingredientes que aporta la main skill: específicos (Ingredient Draw, p. ej.
  // Crustle) y/o total al azar (Ingredient Magnet, p. ej. Plusle).
  skill_ingredients: SlotProduction[];
  skill_ingredient_total: number | null;
  // Berry Burst / Lunar Blessing: own berries per day and berries of each teammate per day.
  skill_berry_amount: number | null;
  skill_berries_per_teammate: number | null;
  // Members each help grant reaches: 1, 2, or 5 (the whole team); null without grants.
  skill_help_targets?: number | null;
  // Otras salidas de la main skill (una por especie según su tipo; el resto null).
  skill_energy: number | null;
  skill_cooking_ingredients: number | null;
  skill_strength: number | null;
  skill_self_energy: number | null;
  skill_dream_shards: number | null;
  skill_tasty_chance: number | null;
  skill_extra_helpful: number | null;
  skill_random_energy: number | null;
}

export interface Member {
  id: string;
  species: string;
  // Entero 1..100.
  level: number;
  // "" = sin naturaleza.
  nature: string;
  // Exactamente 3, uno por slot.
  ingredients: string[];
  // Hasta 5, sin repetir.
  sub_skills: string[];
  // "" = sin listón.
  ribbon: string;
  // Nivel de la main skill (1..7); se sube aparte del nivel del Pokémon.
  skill_level: number;
  // Producción del overview (presente en el listado de la caja).
  production?: MemberProduction;
}

// Payload de alta/edición. Mismas invariantes que Member (el backend valida y
// devuelve 400 {detail} si se violan).
export interface MemberInput {
  species: string;
  // Entero 1..100.
  level: number;
  // "" = sin naturaleza.
  nature: string;
  // Exactamente 3, uno por slot (NO filtrar antes de enviar).
  ingredients: string[];
  // Hasta 5, sin repetir.
  sub_skills: string[];
  // "" = sin listón.
  ribbon: string;
  // Nivel de la main skill (1..7).
  skill_level: number;
}

export interface Distributions {
  natures: Record<string, number>;
  ingredients: Record<string, number>;
  sub_skills: Record<string, number>;
  nature_stats: Record<string, number>;
}

/** One sleep's length, time spent full, and skill chances P(N ≥ k) (PRD 0015). */
export interface SleepSession {
  kind: "night" | "nap";
  hours: number;
  overflow_hours: number;
  skill_chances: number[];
}

/** A night and an optional nap, in minutes on a 15-minute grid (PRD 0015). */
export interface SleepSchedule {
  night_minutes: number;
  nap_minutes: number | null;
}

export interface ProductionInput {
  species: string;
  level: number;
  ingredients: string[];
  nature: string;
  sub_skills: string[];
  ribbon: string;
  skill_level: number;
  // Comparison's map terms; omitted means Normal with no favorites.
  island?: string | null;
  favorite_berries?: string[];
  main_favorite?: string | null;
  weekly_bonus?: WeeklyBonus | null;
  sleep?: SleepSchedule;
}

export interface SlotProduction {
  ingredient: string;
  amount: number;
}

export interface IngredientCount {
  ingredient: string;
  count: number;
}

export interface Recipe {
  name: string;
  type: "Curry" | "Salad" | "Dessert";
  ingredients: IngredientCount[];
  base_strength: number;
}

export interface MealInput {
  recipe: string;
  level: number;
}

export interface TeamProductionEntryInput {
  id: string;
  weight: number;
  pokemon: MemberInput;
}

export interface TeamProductionInput {
  slots: { entries: TeamProductionEntryInput[] }[];
  meals: (MealInput | null)[];
  favorite_berries?: string[];
  island?: string | null;
  main_favorite?: string | null;
  weekly_bonus?: WeeklyBonus;
  island_bonus?: number;
  good_camp_ticket?: boolean;
  pot_size: number;
  event_effects?: EventEffectRequest[];
  sleep?: SleepSchedule;
}

export interface IngredientBalance {
  ingredient: string;
  required: number;
  produced: number;
  balance: number;
}

export interface SlotIngredientStatus {
  ingredient: string;
  required: number;
  available: number;
}

export interface MealFeasibility {
  recipe_name: string;
  met: boolean;
  level: number;
  strength: number;
  strength_base: number;
  fits_pot: boolean;
  ingredients: SlotIngredientStatus[];
}

export interface PotInfo {
  per_meal: number;
  skill_per_meal: number;
  daily: number;
  base_daily: number;
  skill_daily: number;
  bonus_daily: number;
  used_by_recipes: number;
  filler_room: number;
}

export interface Filler {
  ingredient: string | null;
  strength: number;
  available: number;
  used: number;
  contributed: number;
}

export interface Kitchen {
  pot: PotInfo;
  fillers: Filler[];
  recipe_strength: number;
  recipe_strength_base: number;
  filler_strength: number;
  filler_strength_base: number;
  extra_tasty_bonus: number;
  total: number;
  total_base: number;
}

export interface SkillEffectAgg {
  kind: string;
  total: number;
  triggers: number;
}

export interface MemberContribution {
  id: string;
  species: string;
  strength: number;
  // Fuerza base del miembro (sin bonus de isla aplicado).
  strength_base: number;
  berry_amount: number;
  ingredients_total: number;
  skill_triggers: number;
  production: Production;
}

export interface TeamProduction {
  member_count: number;
  total_strength: number;
  total_berry_amount: number;
  total_berry_strength: number;
  total_skill_strength: number;
  // Campos base (versión sin el bonus de isla; siempre presentes, iguales al valor con bonus cuando island_bonus es 0).
  island_bonus: number;
  total_strength_base: number;
  total_berry_strength_base: number;
  total_skill_strength_base: number;
  grand_total_strength_base: number;
  ingredients: SlotProduction[];
  total_ingredients: number;
  skill_triggers: number;
  skill_energy: number | null;
  skill_self_energy: number | null;
  skill_dream_shards: number | null;
  skill_tasty_chance: number | null;
  skill_random_energy: number | null;
  skill_cooking_ingredients: number | null;
  skill_ingredient_total: number | null;
  // Extra Tasty del equipo: chance promedio (0..1) y multiplicador esperado por plato.
  extra_tasty_rate: number;
  extra_tasty_multiplier: number;
  skill_effects: SkillEffectAgg[];
  members: MemberContribution[];
  kitchen: Kitchen;
  cooking_ingredients: IngredientBalance[];
  cooking_surplus: IngredientBalance[];
  cooking_meals: MealFeasibility[];
  grand_total_strength: number;
  // Team berries by type, with where each amount comes from (helps vs Berry Burst).
  berries: TeamBerryRow[];
}

export interface Production {
  helps_per_day: number;
  seconds_per_help: number;
  berry: string;
  berry_amount: number;
  // Fuerza/día DIRECTA de las bayas (bayas × fuerza por baya del nivel).
  berry_strength: number;
  berry_percentage: number;
  ingredient_percentage: number;
  skill_percentage: number;
  effective_skill_percentage: number;
  ingredients: SlotProduction[];
  skill_triggers: number;
  // Ingredientes/día que aporta la main skill (Ingredient Draw S), uno por
  // ingrediente del pool. Vacío si la skill de la especie no produce ingredientes.
  skill_ingredients: SlotProduction[];
  // Berry Burst / Lunar Blessing: own berries/day and their strength (null for other skills).
  skill_berry_amount: number | null;
  skill_berry_strength: number | null;
  // Berry Burst: berries of each teammate per day (count only).
  skill_berries_per_teammate: number | null;
  // Members each help grant reaches: 1, 2, or 5 (the whole team); null without grants.
  skill_help_targets?: number | null;
  // Items per day: candies of any Pokémon (Present) and Berry Juice; null otherwise.
  skill_candy?: number | null;
  skill_berry_juice?: number | null;
  // Bad Dreams: Energy per day each non-Dark teammate loses; null otherwise.
  skill_energy_drain?: number | null;
  // Berry Burst: per-berry yield from teammates (null without a team).
  teammate_berries: BerryYield[] | null;
  // Extra Helpful: ingredients obtained from teammates (null without a team).
  teammate_ingredients: SlotProduction[] | null;
  // Energía/día que la main skill restaura a CADA compañero (Energy for Everyone S).
  // null si la skill de la especie no restaura energía al equipo.
  skill_energy: number | null;
  // Ingredientes/día (de cualquier tipo, al azar) que consigue la main skill
  // (Ingredient Magnet S), como total sin desglosar. null si no aplica.
  skill_ingredient_total: number | null;
  // Ingredientes extra de pote/día que aporta la main skill (Cooking Power-Up S).
  // null si la skill de la especie no agranda el pote.
  skill_cooking_ingredients: number | null;
  // Fuerza/día que la main skill suma a Snorlax (Charge Strength S / M). Para los
  // montos aleatorios es el valor esperado (punto medio). null si no aplica.
  skill_strength: number | null;
  // Energía/día que la main skill restaura al PROPIO Pokémon (Charge Energy S).
  // null si la skill de la especie no carga energía al usuario.
  skill_self_energy: number | null;
  // Fragmentos de sueño/día que consigue la main skill (Dream Shard Magnet S). Para
  // los montos aleatorios es el valor esperado (punto medio). null si no aplica.
  skill_dream_shards: number | null;
  // Aumento de Extra Tasty (en %) por activación de la main skill (Tasty Chance S).
  // Es el valor del nivel, no un total por día. null si la skill no lo da.
  skill_tasty_chance: number | null;
  // Multiplicador de ayuda total del día por la main skill (Extra Helpful S):
  // disparos × ×N_del_nivel. null si la skill no da ayuda instantánea.
  skill_extra_helpful: number | null;
  // Energía/día que la main skill reparte al equipo, a un compañero al azar cada
  // disparo (Energizing Cheer S). null si la skill no lo da.
  skill_random_energy: number | null;
  sleep_sessions: SleepSession[];
  inventory: number;
  inventory_fill_hours: number;
  /** Skill level actually used (with the main favorite's +1, already capped). */
  effective_skill_level: number;
}

/** The player profile (PRD 0011, 0015). Mappings hold only non-defaults. */
export interface PlayerProgress {
  pot_size: number;
  recipe_levels: Record<string, number>;
  /** Keyed by dish type: "Curry" | "Salad" | "Dessert". */
  favorite_recipes: Record<string, string>;
  /** Keyed by area name, in percentage points (0–85). */
  area_bonuses: Record<string, number>;
  sleep: SleepSchedule;
}

/** A sparse change. An absent field is untouched; inside a mapping, a default removes. */
export interface ProgressPatch {
  pot_size?: number;
  recipe_levels?: Record<string, number>;
  favorite_recipes?: Record<string, string | null>;
  area_bonuses?: Record<string, number>;
  sleep?: SleepSchedule;
}

// A saved team (PRD 0016): a named line-up of Box members plus the map and meals.
export interface SavedTeamSlot {
  // Box member ids: 1, or 2 for a split slot.
  members: string[];
  // The first member's time share, 0..1 (1 for a single slot).
  share: number;
}

export interface SavedTeamInput {
  name: string;
  slots: SavedTeamSlot[];
  island: string | null;
  favorite_berries: string[];
  main_favorite: string | null;
  weekly_bonus: WeeklyBonus;
  dish_type: DishType | null;
  // Exactly 3: breakfast, lunch, dinner. Levels come from the Player profile.
  meals: (string | null)[];
}

export interface SavedTeam extends SavedTeamInput {
  id: string;
  // ISO datetime of the last save (create or replace; a rename keeps it).
  saved_at: string;
}

export type DishType = Recipe["type"];
