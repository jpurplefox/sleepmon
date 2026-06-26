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

export interface Member {
  id: string;
  species: string;
  level: number;
  nature: string;
  ingredients: string[];
  sub_skills: string[];
}

export interface MemberInput {
  species: string;
  level: number;
  nature: string;
  ingredients: string[];
  sub_skills: string[];
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
  berry_percentage: number;
  ingredient_percentage: number;
  skill_percentage: number;
  effective_skill_percentage: number;
  ingredients: SlotProduction[];
  skill_triggers: number;
  night_skill_chances: number[];
  inventory: number;
  inventory_fill_hours: number;
}
