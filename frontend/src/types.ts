// Tipos espejo de los schemas del backend (sleepmon.adapters.inbound.http.schemas).

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

export interface Catalog {
  natures: Nature[];
  sub_skills: SubSkill[];
  ingredients: string[];
  species: Species[];
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

export interface ProductionInput {
  species: string;
  level: number;
  ingredients: string[];
  nature: string;
  sub_skills: string[];
  ribbon: string;
  skill_level: number;
}

export interface SlotProduction {
  ingredient: string;
  amount: number;
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
  night_skill_chances: number[];
  inventory: number;
  inventory_fill_hours: number;
}
