"""The game's official Spanish names, so the reader maps Spanish screenshots exactly.

Mirrors frontend/src/i18n/terms.ts (Pokéxperto names); keep both in sync.
"""

from __future__ import annotations

from typing import Final

NATURES_ES: Final[dict[str, str]] = {
    "Lonely": "Huraña",
    "Adamant": "Firme",
    "Naughty": "Pícara",
    "Brave": "Audaz",
    "Bold": "Osada",
    "Impish": "Agitada",
    "Lax": "Floja",
    "Relaxed": "Plácida",
    "Modest": "Modesta",
    "Mild": "Afable",
    "Rash": "Alocada",
    "Quiet": "Mansa",
    "Calm": "Serena",
    "Gentle": "Amable",
    "Careful": "Cauta",
    "Sassy": "Grosera",
    "Timid": "Miedosa",
    "Hasty": "Activa",
    "Jolly": "Alegre",
    "Naive": "Ingenua",
    "Bashful": "Tímida",
    "Hardy": "Fuerte",
    "Docile": "Dócil",
    "Quirky": "Rara",
    "Serious": "Seria",
}

NATURE_STATS_ES: Final[dict[str, str]] = {
    "Speed of Help": "Rapidez de ayuda",
    "Ingredient Finding": "Buscar ingredientes",
    "Energy Recovery": "Recuperar energía",
    "EXP Gains": "EXP ganada",
    "Main Skill Chance": "Activar habilidad",
}

SUB_SKILLS_ES: Final[dict[str, str]] = {
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
}
