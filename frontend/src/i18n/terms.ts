// Traducciones OFICIALES de los términos del juego (Pokémon Sleep en español).
// Fuentes: Pokéxperto (pokemonsleep), WikiDex. La clave es el nombre en inglés que
// manda el backend (canónico); el valor es el nombre oficial en español. Para inglés
// se usa la propia clave. NO inventar: si falta una entrada, se cae al nombre inglés.

export type Lang = "es" | "en";

// 25 naturalezas (nombres oficiales de la saga, WikiDex).
const NATURES_ES: Record<string, string> = {
  Lonely: "Huraña",
  Adamant: "Firme",
  Naughty: "Pícara",
  Brave: "Audaz",
  Bold: "Osada",
  Impish: "Agitada",
  Lax: "Floja",
  Relaxed: "Plácida",
  Modest: "Modesta",
  Mild: "Afable",
  Rash: "Alocada",
  Quiet: "Mansa",
  Calm: "Serena",
  Gentle: "Amable",
  Careful: "Cauta",
  Sassy: "Grosera",
  Timid: "Miedosa",
  Hasty: "Activa",
  Jolly: "Alegre",
  Naive: "Ingenua",
  Bashful: "Tímida",
  Hardy: "Fuerte",
  Docile: "Dócil",
  Quirky: "Rara",
  Serious: "Seria",
};

// 5 stats de naturaleza (Pokéxperto, Pokémon Sleep).
const NATURE_STATS_ES: Record<string, string> = {
  "Speed of Help": "Rapidez de ayuda",
  "Ingredient Finding": "Buscar ingredientes",
  "Energy Recovery": "Recuperar energía",
  "EXP Gains": "EXP ganada",
  "Main Skill Chance": "Activar habilidad",
};

// 19 ingredientes (Pokéxperto).
const INGREDIENTS_ES: Record<string, string> = {
  "Large Leek": "Puerro Grueso",
  "Tasty Mushroom": "Seta Sabrosa",
  "Fancy Egg": "Huevo Selecto",
  "Soft Potato": "Patata",
  "Fancy Apple": "Manzana Selecta",
  "Fiery Herb": "Hierba Picante",
  "Bean Sausage": "Fiambre Vegetariano",
  "Moomoo Milk": "Leche Mu-mu",
  Honey: "Miel",
  "Pure Oil": "Aceite Puro",
  "Warming Ginger": "Jengibre",
  "Snoozy Tomato": "Siestomate",
  "Soothing Cacao": "Cacao Relajante",
  "Slowpoke Tail": "Cola de Slowpoke",
  "Greengrass Soybeans": "Soja Verdegal",
  "Greengrass Corn": "Maíz Verdegal",
  "Rousing Coffee": "Café Estimulante",
  "Plump Pumpkin": "Calabaza Suculenta",
  "Glossy Avocado": "Aguacate",
};

// 19 bayas (Pokéxperto / WikiDex). El valor incluye solo el nombre propio; el prefijo
// "Baya " lo agrega quien lo necesite.
const BERRIES_ES: Record<string, string> = {
  Bluk: "Oram",
  Cheri: "Zreza",
  Durin: "Rudion",
  Figy: "Higog",
  Grepa: "Uvav",
  Leppa: "Zanama",
  Lum: "Ziuela",
  Mago: "Ango",
  Oran: "Aranja",
  Pamtre: "Plama",
  Pecha: "Meloc",
  Persim: "Caquic",
  Rawst: "Safre",
  Sitrus: "Zidra",
  Wiki: "Wiki",
  Yache: "Rimoya",
  Belue: "Andano",
  Rabuta: "Rautan",
  Chesto: "Atania",
};

// 17 sub skills (Pokéxperto, habilidades secundarias).
const SUB_SKILLS_ES: Record<string, string> = {
  "Sleep EXP Bonus": "Bonus EXP al Dormir",
  "Skill Level Up M": "Nivel Habilidad M",
  "Research EXP Bonus": "Bonus EXP de Estudio",
  "Helping Bonus": "Bonus Ayuda",
  "Energy Recovery Bonus": "Bonus Recupera Energía",
  "Dream Shard Bonus": "Bonus Fragmentos Sueños",
  "Berry Finding S": "Busca Bayas S",
  "Skill Trigger M": "Activación M",
  "Skill Level Up S": "Nivel Habilidad S",
  "Ingredient Finder M": "Más Ingredientes M",
  "Helping Speed M": "Velocidad Ayuda M",
  "Inventory Up M": "Inventario M",
  "Inventory Up L": "Inventario L",
  "Skill Trigger S": "Activación S",
  "Inventory Up S": "Inventario S",
  "Ingredient Finder S": "Más Ingredientes S",
  "Helping Speed S": "Velocidad Ayuda S",
};

// Especialidades (Pokémon Sleep).
const SPECIALTIES_ES: Record<string, string> = {
  Berries: "Bayas",
  Ingredients: "Ingredientes",
  Skills: "Habilidades",
  All: "Todas",
};

// Nombres base de las main skills (Pokéxperto). Las variantes entre paréntesis se
// traducen aparte (ver SKILL_VARIANTS_ES).
const MAIN_SKILLS_ES: Record<string, string> = {
  "Ingredient Magnet S": "Imán Ingredientes S",
  "Ingredient Draw S": "Ingrediente Aleatorio S",
  "Energy for Everyone S": "Energía para Todos S",
  "Charge Energy S": "Carga Energía S",
  "Energizing Cheer S": "Ánimo Enérgico S",
  "Charge Strength S": "Carga Vigor S",
  "Charge Strength M": "Carga Vigor M",
  "Dream Shard Magnet S": "Imán Fragmentos S",
  "Cooking Power-Up S": "Receta Sustanciosa S",
  "Tasty Chance S": "Cocinitas S",
  "Extra Helpful S": "Superútil S",
  "Metronome": "Metrónomo",
  "Berry Burst": "Bayamanía",
  "Helper Boost": "Mejora de Ayuda",
  "Cooking Assist S": "Ayuda de Cocina S",
  "Skill Copy": "Imitar Habilidad",
};

// Variantes entre paréntesis de las main skills. Las que son habilidades/movimientos/
// objetos usan su nombre oficial en español; las descriptivas, su equivalente.
const SKILL_VARIANTS_ES: Record<string, string> = {
  Random: "Aleatorio",
  Plus: "Más",
  Minus: "Menos",
  Stockpile: "Reserva",
  "Super Luck": "Afortunado",
  "Hyper Cutter": "Corte Vacío",
  Moonlight: "Luz Lunar",
  "Lunar Blessing": "Bendición Lunar",
  Present: "Presente",
  "Heal Pulse": "Pulso Cura",
  Nuzzle: "Moflete Estático",
  "Berry Juice": "Zumo de Baya",
  "Bulk Up": "Corpulencia",
  Mimic: "Mimético",
  Transform: "Transformación",
};

const pick = (map: Record<string, string>, name: string, lang: Lang) =>
  lang === "en" ? name : (map[name] ?? name);

export const tNature = (name: string, lang: Lang) => pick(NATURES_ES, name, lang);
export const tNatureStat = (name: string, lang: Lang) => pick(NATURE_STATS_ES, name, lang);
export const tIngredient = (name: string, lang: Lang) => pick(INGREDIENTS_ES, name, lang);
export const tSubSkill = (name: string, lang: Lang) => pick(SUB_SKILLS_ES, name, lang);
export const tSpecialty = (name: string, lang: Lang) => pick(SPECIALTIES_ES, name, lang);

// Baya: en inglés el backend manda solo "Oran" (sin "Berry"); en español se muestra
// "Baya Aranja".
export const tBerry = (name: string, lang: Lang) =>
  lang === "en" ? name : `Baya ${BERRIES_ES[name] ?? name}`;

// Main skill: traduce el nombre base y la variante entre paréntesis por separado.
export const tMainSkill = (name: string, lang: Lang): string => {
  if (lang === "en") return name;
  const m = name.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) {
    const base = MAIN_SKILLS_ES[m[1]] ?? m[1];
    const variant = SKILL_VARIANTS_ES[m[2]] ?? m[2];
    return `${base} (${variant})`;
  }
  return MAIN_SKILLS_ES[name] ?? name;
};
