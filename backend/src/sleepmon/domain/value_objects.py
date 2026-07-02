"""Conjuntos cerrados del dominio de Pokémon Sleep.

Cada miembro de tu equipo se describe con una **naturaleza**, hasta cinco
**sub skills** y hasta tres **ingredientes**. Los valores posibles de cada eje
son fijos en el juego, así que se modelan como enums: el valor de cada miembro es
el nombre propio tal como aparece en el juego (y tal como se persiste en la base).
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Specialty(StrEnum):
    """Especialidad de una especie."""

    BERRIES = "Berries"
    INGREDIENTS = "Ingredients"
    SKILLS = "Skills"
    ALL = "All"


class SleepType(StrEnum):
    """Tipo de sueño con el que aparece una especie."""

    DOZING = "Dozing"
    SNOOZING = "Snoozing"
    SLUMBERING = "Slumbering"


class NatureStat(StrEnum):
    """Los cinco stats que una naturaleza puede subir o bajar."""

    SPEED_OF_HELP = "Speed of Help"
    INGREDIENT_FINDING = "Ingredient Finding"
    ENERGY_RECOVERY = "Energy Recovery"
    EXP_GAINS = "EXP Gains"
    MAIN_SKILL_CHANCE = "Main Skill Chance"


class Nature(StrEnum):
    """Las 25 naturalezas del juego."""

    # Speed of Help ↑
    LONELY = "Lonely"
    ADAMANT = "Adamant"
    NAUGHTY = "Naughty"
    BRAVE = "Brave"
    # Energy Recovery ↑
    BOLD = "Bold"
    IMPISH = "Impish"
    LAX = "Lax"
    RELAXED = "Relaxed"
    # Ingredient Finding ↑
    MODEST = "Modest"
    MILD = "Mild"
    RASH = "Rash"
    QUIET = "Quiet"
    # Main Skill Chance ↑
    CALM = "Calm"
    GENTLE = "Gentle"
    CAREFUL = "Careful"
    SASSY = "Sassy"
    # EXP Gains ↑
    TIMID = "Timid"
    HASTY = "Hasty"
    JOLLY = "Jolly"
    NAIVE = "Naive"
    # Neutrales
    BASHFUL = "Bashful"
    HARDY = "Hardy"
    DOCILE = "Docile"
    QUIRKY = "Quirky"
    SERIOUS = "Serious"


class SubSkill(StrEnum):
    """Las 17 sub skills del juego."""

    # Gold
    SLEEP_EXP_BONUS = "Sleep EXP Bonus"
    SKILL_LEVEL_UP_M = "Skill Level Up M"
    RESEARCH_EXP_BONUS = "Research EXP Bonus"
    HELPING_BONUS = "Helping Bonus"
    ENERGY_RECOVERY_BONUS = "Energy Recovery Bonus"
    DREAM_SHARD_BONUS = "Dream Shard Bonus"
    BERRY_FINDING_S = "Berry Finding S"
    # Blue
    SKILL_TRIGGER_M = "Skill Trigger M"
    SKILL_LEVEL_UP_S = "Skill Level Up S"
    INGREDIENT_FINDER_M = "Ingredient Finder M"
    HELPING_SPEED_M = "Helping Speed M"
    INVENTORY_UP_M = "Inventory Up M"
    INVENTORY_UP_L = "Inventory Up L"
    # Regular
    SKILL_TRIGGER_S = "Skill Trigger S"
    INVENTORY_UP_S = "Inventory Up S"
    INGREDIENT_FINDER_S = "Ingredient Finder S"
    HELPING_SPEED_S = "Helping Speed S"


class SubSkillTier(StrEnum):
    """Rareza/tier de una sub skill."""

    GOLD = "Gold"
    BLUE = "Blue"
    REGULAR = "Regular"


class Ingredient(StrEnum):
    """Los 19 ingredientes del juego."""

    LARGE_LEEK = "Large Leek"
    TASTY_MUSHROOM = "Tasty Mushroom"
    FANCY_EGG = "Fancy Egg"
    SOFT_POTATO = "Soft Potato"
    FANCY_APPLE = "Fancy Apple"
    FIERY_HERB = "Fiery Herb"
    BEAN_SAUSAGE = "Bean Sausage"
    MOOMOO_MILK = "Moomoo Milk"
    HONEY = "Honey"
    PURE_OIL = "Pure Oil"
    WARMING_GINGER = "Warming Ginger"
    SNOOZY_TOMATO = "Snoozy Tomato"
    SOOTHING_CACAO = "Soothing Cacao"
    SLOWPOKE_TAIL = "Slowpoke Tail"
    GREENGRASS_SOYBEANS = "Greengrass Soybeans"
    GREENGRASS_CORN = "Greengrass Corn"
    ROUSING_COFFEE = "Rousing Coffee"
    PLUMP_PUMPKIN = "Plump Pumpkin"
    GLOSSY_AVOCADO = "Glossy Avocado"


class Berry(StrEnum):
    """Bayas que puede cargar una especie (una por especie)."""

    BLUK = "Bluk"
    CHERI = "Cheri"
    CHESTO = "Chesto"
    DURIN = "Durin"
    FIGY = "Figy"
    GREPA = "Grepa"
    LEPPA = "Leppa"
    LUM = "Lum"
    MAGO = "Mago"
    ORAN = "Oran"
    PAMTRE = "Pamtre"
    PECHA = "Pecha"
    PERSIM = "Persim"
    RAWST = "Rawst"
    SITRUS = "Sitrus"
    WIKI = "Wiki"
    YACHE = "Yache"
    BELUE = "Belue"
    RABUTA = "Rabuta"


class Type(StrEnum):
    """Tipo elemental del Pokémon (los 18 tipos del juego principal).

    En Pokémon Sleep el tipo está en **bijección con la baya** que carga la especie;
    se modela aparte porque a veces es más fácil identificar el tipo que la baya, y
    habilita filtrar la Caja por tipo. El tipo de una especie se deriva de su baya
    vía ``BERRY_TYPE`` (no se almacena duplicado por especie)."""

    NORMAL = "Normal"
    FIRE = "Fire"
    WATER = "Water"
    ELECTRIC = "Electric"
    GRASS = "Grass"
    ICE = "Ice"
    FIGHTING = "Fighting"
    POISON = "Poison"
    GROUND = "Ground"
    FLYING = "Flying"
    PSYCHIC = "Psychic"
    BUG = "Bug"
    ROCK = "Rock"
    GHOST = "Ghost"
    DRAGON = "Dragon"
    DARK = "Dark"
    STEEL = "Steel"
    FAIRY = "Fairy"


# Bijección tipo↔baya del juego: cada baya pertenece a un único tipo. Se valida
# contra el catálogo (todas las especies de una misma baya comparten tipo) en los
# tests del dominio. ``Berry.RABUTA`` no la carga ninguna especie del catálogo
# curado, así que no tiene tipo asignado (la derivación nunca la consulta).
BERRY_TYPE: dict[Berry, Type] = {
    Berry.PERSIM: Type.NORMAL,
    Berry.LEPPA: Type.FIRE,
    Berry.ORAN: Type.WATER,
    Berry.GREPA: Type.ELECTRIC,
    Berry.DURIN: Type.GRASS,
    Berry.RAWST: Type.ICE,
    Berry.CHERI: Type.FIGHTING,
    Berry.CHESTO: Type.POISON,
    Berry.FIGY: Type.GROUND,
    Berry.PAMTRE: Type.FLYING,
    Berry.MAGO: Type.PSYCHIC,
    Berry.LUM: Type.BUG,
    Berry.SITRUS: Type.ROCK,
    Berry.BLUK: Type.GHOST,
    Berry.YACHE: Type.DRAGON,
    Berry.WIKI: Type.DARK,
    Berry.BELUE: Type.STEEL,
    Berry.PECHA: Type.FAIRY,
}


class Ribbon(StrEnum):
    """Listón ganado por horas de sueño acumuladas con un Pokémon.

    El valor es la marca de horas (cadena estable que se persiste igual que la
    naturaleza). ``NONE`` (cadena vacía) = sin listón. Cada listón sube el
    inventario y, a las 500h/2000h, además acelera la frecuencia de ayuda según
    las evoluciones de la línea (ver ``catalog_data``).
    """

    NONE = ""
    SLEEP_200 = "200h"
    SLEEP_500 = "500h"
    SLEEP_1000 = "1000h"
    SLEEP_2000 = "2000h"


class RecipeType(StrEnum):
    """Los tres tipos de receta de Pokémon Sleep."""

    CURRY = "Curry"  # curries y guisos
    SALAD = "Salad"
    DESSERT = "Dessert"  # postres y bebidas


class Island(StrEnum):
    """Islas / áreas de investigación de Pokémon Sleep."""

    GREENGRASS_ISLE = "Greengrass Isle"
    GREENGRASS_EXPERT = "Greengrass Isle (Expert Mode)"
    CYAN_BEACH = "Cyan Beach"
    TAUPE_HOLLOW = "Taupe Hollow"
    SNOWDROP_TUNDRA = "Snowdrop Tundra"
    LAPIS_LAKESIDE = "Lapis Lakeside"
    OLD_GOLD_POWER_PLANT = "Old Gold Power Plant"
    AMBER_CANYON = "Amber Canyon"


class RatingTier(StrEnum):
    """Tramos del rating de Snorlax; cada uno se muestra con su ball."""

    BASIC = "basic"
    GREAT = "great"
    ULTRA = "ultra"
    MASTER = "master"


@dataclass(frozen=True, slots=True)
class RatingThreshold:
    """Un rating de investigación y la fuerza (semanal) que exige."""

    tier: RatingTier
    level: int
    required_strength: int
