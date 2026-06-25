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
  specialty: string;
  berry: string;
  sleep_type: string;
  main_skill: string;
  ingredient_slots: string[][];
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
  nickname: string | null;
}

export interface MemberInput {
  species: string;
  level: number;
  nature: string;
  ingredients: string[];
  sub_skills: string[];
  nickname: string | null;
}

export interface Distributions {
  natures: Record<string, number>;
  ingredients: Record<string, number>;
  sub_skills: Record<string, number>;
  nature_stats: Record<string, number>;
}
