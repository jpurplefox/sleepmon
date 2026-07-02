"""Reglas y tablas de referencia del juego (no dependen de ningún Pokémon concreto).

Acá viven:
- el efecto (↑/↓) de cada naturaleza sobre los cinco stats,
- el tier de cada sub skill,
- los niveles en los que se desbloquean slots de sub skill e ingrediente.

Son datos del *juego*, estables, parte del núcleo del dominio.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final

from sleepmon.domain.value_objects import (
    Berry,
    Ingredient,
    Island,
    Nature,
    NatureStat,
    Ribbon,
    SubSkill,
    SubSkillTier,
)

# Niveles en los que se desbloquean los slots. Actualizado en el último parche:
# las sub skills pasaron a 10/25/50/70/80.
SUB_SKILL_UNLOCK_LEVELS: Final[tuple[int, ...]] = (10, 25, 50, 70, 80)
INGREDIENT_UNLOCK_LEVELS: Final[tuple[int, ...]] = (1, 30, 60)

MAX_SUB_SKILLS: Final[int] = len(SUB_SKILL_UNLOCK_LEVELS)
MAX_INGREDIENTS: Final[int] = len(INGREDIENT_UNLOCK_LEVELS)
MAX_LEVEL: Final[int] = 100
# Nivel máximo "habitual" de una main skill (se sube aparte del nivel del Pokémon,
# con caramelos y sub skills de Skill Level Up). La mayoría de las skills toman este
# tope; define el largo de sus tablas de salida (ver domain/skills.py).
MAX_SKILL_LEVEL: Final[int] = 7
# Algunas skills llegan más alto (Dream Shard Magnet S: nivel 8) y otras topan antes
# (E4E / Charge Energy: nivel 6). Esta es la cota ABSOLUTA que valida la entidad y la
# aplicación; el tope real por skill lo decide cada tabla.
MAX_SKILL_LEVEL_ABSOLUTE: Final[int] = 8

# Cada evolución sube el carry limit (inventario base) en una cantidad fija: el
# inventario base del catálogo es el de la forma sin evolucionar y se le suma este
# bonus por cada evolución (una evolución -> +5, dos evoluciones -> +10).
INVENTORY_BONUS_PER_EVOLUTION: Final[int] = 5
# Una especie evoluciona como mucho dos veces (línea de tres formas).
MAX_EVOLUTION_STAGE: Final[int] = 2

# Reparto día/noche: de noche el inventario no se vacía, así que una vez lleno solo
# se juntan bayas. De día se asume que nunca se llena.
NIGHT_HOURS: Final[float] = 8.5
DAY_HOURS: Final[float] = 24 - NIGHT_HOURS

# La frecuencia de ayuda baja con el nivel (el Pokémon ayuda más rápido): cada nivel
# por encima de 1 resta 0.2% de la frecuencia base -> freq = base * (1 - 0.002*(lvl-1)).
FREQUENCY_REDUCTION_PER_LEVEL: Final[float] = 0.002

# Good Camp Ticket: los Pokémon ayudan 20% más rápido (intervalo × 0.8) y cargan
# 20% más de inventario (carry size × 1.2). El efecto de pote (×1.5) es frontend.
GOOD_CAMP_TICKET_SPEED_FACTOR: Final[float] = 0.8
GOOD_CAMP_TICKET_INVENTORY_FACTOR: Final[float] = 1.2

# "Pity proc": si pasan N ayudas seguidas sin disparar la main skill, la siguiente la
# dispara sí o sí. Sube la tasa efectiva de skill por encima de la base (clave en
# especies de tasa baja).
#   - No especialistas en skill (ingrediente/baya): umbral FIJO de 78 ayudas.
#   - Especialistas en SKILL: umbral PROPIO que sale de su frecuencia base —el juego
#     fuerza la skill tras ~140000 s de tiempo base sin activarla, así que el límite
#     en ayudas es 140000 / frecuencia_base (los rápidos toleran más ayudas, los
#     lentos menos). Ver ``Species.pity_helps``.
SKILL_PITY_HELPS: Final[int] = 78
SKILL_SPECIALIST_PITY_SECONDS: Final[int] = 140_000
# Bonus de frecuencia de ayuda por energía máxima. La producción siempre lo asume
# (el Pokémon ayuda 2+2/9 ≈ 2.2222x más rápido que su frecuencia base).
MAX_ENERGY_BONUS: Final[float] = 2 + 2 / 9


@dataclass(frozen=True, slots=True)
class NatureEffect:
    """Stat que la naturaleza sube y stat que baja. ``None`` en ambos si es neutra."""

    increased: NatureStat | None
    decreased: NatureStat | None

    @property
    def is_neutral(self) -> bool:
        return self.increased is None and self.decreased is None


_S = NatureStat

NATURE_EFFECTS: Final[Mapping[Nature, NatureEffect]] = {
    # Speed of Help ↑
    Nature.LONELY: NatureEffect(_S.SPEED_OF_HELP, _S.ENERGY_RECOVERY),
    Nature.ADAMANT: NatureEffect(_S.SPEED_OF_HELP, _S.INGREDIENT_FINDING),
    Nature.NAUGHTY: NatureEffect(_S.SPEED_OF_HELP, _S.MAIN_SKILL_CHANCE),
    Nature.BRAVE: NatureEffect(_S.SPEED_OF_HELP, _S.EXP_GAINS),
    # Energy Recovery ↑
    Nature.BOLD: NatureEffect(_S.ENERGY_RECOVERY, _S.SPEED_OF_HELP),
    Nature.IMPISH: NatureEffect(_S.ENERGY_RECOVERY, _S.INGREDIENT_FINDING),
    Nature.LAX: NatureEffect(_S.ENERGY_RECOVERY, _S.MAIN_SKILL_CHANCE),
    Nature.RELAXED: NatureEffect(_S.ENERGY_RECOVERY, _S.EXP_GAINS),
    # Ingredient Finding ↑
    Nature.MODEST: NatureEffect(_S.INGREDIENT_FINDING, _S.SPEED_OF_HELP),
    Nature.MILD: NatureEffect(_S.INGREDIENT_FINDING, _S.ENERGY_RECOVERY),
    Nature.RASH: NatureEffect(_S.INGREDIENT_FINDING, _S.MAIN_SKILL_CHANCE),
    Nature.QUIET: NatureEffect(_S.INGREDIENT_FINDING, _S.EXP_GAINS),
    # Main Skill Chance ↑
    Nature.CALM: NatureEffect(_S.MAIN_SKILL_CHANCE, _S.SPEED_OF_HELP),
    Nature.GENTLE: NatureEffect(_S.MAIN_SKILL_CHANCE, _S.ENERGY_RECOVERY),
    Nature.CAREFUL: NatureEffect(_S.MAIN_SKILL_CHANCE, _S.INGREDIENT_FINDING),
    Nature.SASSY: NatureEffect(_S.MAIN_SKILL_CHANCE, _S.EXP_GAINS),
    # EXP Gains ↑
    Nature.TIMID: NatureEffect(_S.EXP_GAINS, _S.SPEED_OF_HELP),
    Nature.HASTY: NatureEffect(_S.EXP_GAINS, _S.ENERGY_RECOVERY),
    Nature.JOLLY: NatureEffect(_S.EXP_GAINS, _S.INGREDIENT_FINDING),
    Nature.NAIVE: NatureEffect(_S.EXP_GAINS, _S.MAIN_SKILL_CHANCE),
    # Neutrales
    Nature.BASHFUL: NatureEffect(None, None),
    Nature.HARDY: NatureEffect(None, None),
    Nature.DOCILE: NatureEffect(None, None),
    Nature.QUIRKY: NatureEffect(None, None),
    Nature.SERIOUS: NatureEffect(None, None),
}

SUB_SKILL_TIERS: Final[Mapping[SubSkill, SubSkillTier]] = {
    # Gold
    SubSkill.SLEEP_EXP_BONUS: SubSkillTier.GOLD,
    SubSkill.SKILL_LEVEL_UP_M: SubSkillTier.GOLD,
    SubSkill.RESEARCH_EXP_BONUS: SubSkillTier.GOLD,
    SubSkill.HELPING_BONUS: SubSkillTier.GOLD,
    SubSkill.ENERGY_RECOVERY_BONUS: SubSkillTier.GOLD,
    SubSkill.DREAM_SHARD_BONUS: SubSkillTier.GOLD,
    SubSkill.BERRY_FINDING_S: SubSkillTier.GOLD,
    # Blue
    SubSkill.SKILL_TRIGGER_M: SubSkillTier.BLUE,
    SubSkill.SKILL_LEVEL_UP_S: SubSkillTier.BLUE,
    SubSkill.INGREDIENT_FINDER_M: SubSkillTier.BLUE,
    SubSkill.HELPING_SPEED_M: SubSkillTier.BLUE,
    SubSkill.INVENTORY_UP_M: SubSkillTier.BLUE,
    SubSkill.INVENTORY_UP_L: SubSkillTier.BLUE,
    # Regular
    SubSkill.SKILL_TRIGGER_S: SubSkillTier.REGULAR,
    SubSkill.INVENTORY_UP_S: SubSkillTier.REGULAR,
    SubSkill.INGREDIENT_FINDER_S: SubSkillTier.REGULAR,
    SubSkill.HELPING_SPEED_S: SubSkillTier.REGULAR,
}


# Listones: por horas de sueño acumuladas se gana un listón. Los bonos son
# ACUMULATIVOS: tener el de 2000h implica haber ganado los de 200/500/1000h, así que
# sus efectos se suman. Cada listón sube el inventario; los de 500h y 2000h además
# aceleran la frecuencia de ayuda, pero ese bonus solo aplica si al Pokémon le quedan
# evoluciones (1 o 2): una forma totalmente evolucionada no lo recibe.
RIBBON_HOURS: Final[Mapping[Ribbon, int]] = {
    Ribbon.NONE: 0,
    Ribbon.SLEEP_200: 200,
    Ribbon.SLEEP_500: 500,
    Ribbon.SLEEP_1000: 1000,
    Ribbon.SLEEP_2000: 2000,
}
# Aporte INCREMENTAL de cada listón (lo que suma respecto al anterior). El total de
# un listón es la suma de su escalón y los de todos los listones por debajo.
_RIBBON_INVENTORY_STEP: Final[Mapping[Ribbon, int]] = {
    Ribbon.NONE: 0,
    Ribbon.SLEEP_200: 1,
    Ribbon.SLEEP_500: 2,
    Ribbon.SLEEP_1000: 3,
    Ribbon.SLEEP_2000: 2,
}
# Reducción de frecuencia (fracción) que aporta cada listón, según cuántas
# evoluciones le QUEDAN al Pokémon. Solo 500h y 2000h dan velocidad; una forma sin
# evoluciones pendientes (0) no recibe nada.
_RIBBON_SPEED_STEP: Final[Mapping[Ribbon, Mapping[int, float]]] = {
    Ribbon.SLEEP_500: {1: 0.05, 2: 0.11},
    Ribbon.SLEEP_2000: {1: 0.07, 2: 0.14},
}

# Listones ordenados por horas (ascendente): define qué listones quedan "incluidos"
# al acumular hasta uno dado.
_RIBBON_ORDER: Final[tuple[Ribbon, ...]] = tuple(
    sorted(RIBBON_HOURS, key=lambda r: RIBBON_HOURS[r])
)


def _ribbons_up_to(ribbon: Ribbon) -> tuple[Ribbon, ...]:
    """Los listones ganados al tener ``ribbon`` (él y todos los de menos horas)."""
    return _RIBBON_ORDER[: _RIBBON_ORDER.index(ribbon) + 1]


def ribbon_inventory_bonus(ribbon: Ribbon) -> int:
    """Suba ACUMULADA de inventario del listón (suma de su escalón y los anteriores)."""
    return sum(_RIBBON_INVENTORY_STEP[r] for r in _ribbons_up_to(ribbon))


def ribbon_speed_bonus(ribbon: Ribbon, evolutions_remaining: int) -> float:
    """Reducción de frecuencia ACUMULADA del listón según las evoluciones que le quedan.

    Una forma totalmente evolucionada (0 evoluciones pendientes) no recibe velocidad.
    """
    return sum(
        _RIBBON_SPEED_STEP.get(r, {}).get(evolutions_remaining, 0.0) for r in _ribbons_up_to(ribbon)
    )


# Fuerza base de cada baya (su valor a nivel 1). El objetivo de una especie de bayas
# es subir la fuerza de Snorlax, y cada baya aporta una cantidad distinta: estos son
# los valores crudos del juego, sin el Area Bonus ni el x2 de "baya favorita" (que son
# per-usuario/semanales y quedan fuera del modelo). Fuente: catálogo de nerolis-lab.
BERRY_BASE_STRENGTH: Final[Mapping[Berry, int]] = {
    Berry.BELUE: 33,
    Berry.BLUK: 26,
    Berry.CHERI: 27,
    Berry.CHESTO: 32,
    Berry.DURIN: 30,
    Berry.FIGY: 29,
    Berry.GREPA: 25,
    Berry.LEPPA: 27,
    Berry.LUM: 24,
    Berry.MAGO: 26,
    Berry.ORAN: 31,
    Berry.PAMTRE: 24,
    Berry.PECHA: 26,
    Berry.PERSIM: 28,
    Berry.RABUTA: 30,
    Berry.RAWST: 32,
    Berry.SITRUS: 30,
    Berry.WIKI: 31,
    Berry.YACHE: 35,
}

ISLAND_FAVORITE_BERRIES: Final[Mapping[Island, tuple[Berry, ...]]] = {
    Island.GREENGRASS_ISLE: (),
    Island.GREENGRASS_EXPERT: (),
    Island.CYAN_BEACH: (Berry.ORAN, Berry.PAMTRE, Berry.PECHA),
    Island.TAUPE_HOLLOW: (Berry.FIGY, Berry.LEPPA, Berry.SITRUS),
    Island.SNOWDROP_TUNDRA: (Berry.PERSIM, Berry.RAWST, Berry.WIKI),
    Island.LAPIS_LAKESIDE: (Berry.CHERI, Berry.DURIN, Berry.MAGO),
    Island.OLD_GOLD_POWER_PLANT: (Berry.BELUE, Berry.BLUK, Berry.GREPA),
    Island.AMBER_CANYON: (Berry.CHESTO, Berry.LUM, Berry.YACHE),
}

ISLAND_USER_PICKS: Final[frozenset[Island]] = frozenset(
    {Island.GREENGRASS_ISLE, Island.GREENGRASS_EXPERT}
)

# Fuerza base de cada ingrediente (valor a nivel 1 del Pokémon que lo produce).
# Se usa para estimar la fuerza de los "fillers" en una receta. Fuente: nerolis-lab.
INGREDIENT_STRENGTH: Final[dict[Ingredient, int]] = {
    Ingredient.FANCY_APPLE: 90,
    Ingredient.MOOMOO_MILK: 98,
    Ingredient.GREENGRASS_SOYBEANS: 100,
    Ingredient.HONEY: 101,
    Ingredient.BEAN_SAUSAGE: 103,
    Ingredient.WARMING_GINGER: 109,
    Ingredient.SNOOZY_TOMATO: 110,
    Ingredient.FANCY_EGG: 115,
    Ingredient.PURE_OIL: 121,
    Ingredient.SOFT_POTATO: 124,
    Ingredient.FIERY_HERB: 130,
    Ingredient.GREENGRASS_CORN: 140,
    Ingredient.SOOTHING_CACAO: 151,
    Ingredient.ROUSING_COFFEE: 153,
    Ingredient.GLOSSY_AVOCADO: 162,
    Ingredient.TASTY_MUSHROOM: 167,
    Ingredient.LARGE_LEEK: 185,
    Ingredient.PLUMP_PUMPKIN: 250,
    Ingredient.SLOWPOKE_TAIL: 342,
}
assert set(INGREDIENT_STRENGTH) == set(Ingredient), (
    "INGREDIENT_STRENGTH está desincronizado con el enum Ingredient: "
    f"faltan={set(Ingredient) - set(INGREDIENT_STRENGTH)}, "
    f"extra={set(INGREDIENT_STRENGTH) - set(Ingredient)}"
)

# La baya rinde más fuerza a mayor nivel del Pokémon: se toma el mayor entre un
# crecimiento lineal (base + (nivel-1)) y uno exponencial (base * 1.025^(nivel-1)),
# redondeado. A niveles bajos manda el lineal; a partir de cierto nivel el exponencial
# lo supera. Fuente: fórmula de nerolis-lab (``berryPowerForLevel``).
_BERRY_STRENGTH_GROWTH_RATE: Final[float] = 1.025


def berry_strength_for_level(berry: Berry, level: int, *, favorite: bool = False) -> int:
    """Fuerza que aporta UNA baya de ``berry`` para un Pokémon de nivel ``level``.

    Si la baya es favorita de la isla activa, aporta el doble.
    """
    base = BERRY_BASE_STRENGTH[berry]
    linear = base + (level - 1)
    exponential = base * _BERRY_STRENGTH_GROWTH_RATE ** (level - 1)
    strength = round(max(linear, exponential))
    return strength * 2 if favorite else strength


# Multiplicador de fuerza de una receta según su nivel (1..MAX_RECIPE_LEVEL).
# Índice = nivel-1. RECIPE_LEVEL_BONUS[0] == 1.0 (nivel 1 = sin bonus). Monótona
# creciente. Fuente: nerolis-lab (sleepapi, bonus de nivel de receta), expresado
# como multiplicador = 1 + bonus%/100.
MAX_RECIPE_LEVEL: Final[int] = 70
RECIPE_LEVEL_BONUS: Final[tuple[float, ...]] = (
    1.0, 1.02, 1.04, 1.06, 1.08, 1.09, 1.11, 1.13, 1.16, 1.18,
    1.19, 1.21, 1.23, 1.24, 1.26, 1.28, 1.3, 1.31, 1.33, 1.35,
    1.37, 1.4, 1.42, 1.45, 1.47, 1.5, 1.52, 1.55, 1.58, 1.61,
    1.64, 1.67, 1.7, 1.74, 1.77, 1.81, 1.84, 1.88, 1.92, 1.96,
    2.0, 2.04, 2.08, 2.13, 2.17, 2.22, 2.27, 2.32, 2.37, 2.42,
    2.48, 2.53, 2.59, 2.65, 2.71, 2.77, 2.83, 2.9, 2.97, 3.03,
    3.09, 3.15, 3.21, 3.27, 3.34, 3.39, 3.43, 3.48, 3.52, 3.58,
)
assert len(RECIPE_LEVEL_BONUS) == MAX_RECIPE_LEVEL


def recipe_level_bonus(level: int) -> float:
    """Multiplicador de fuerza de una receta de nivel ``level`` (1..MAX_RECIPE_LEVEL)."""
    if not 1 <= level <= MAX_RECIPE_LEVEL:
        raise ValueError(
            f"El nivel de receta debe estar entre 1 y {MAX_RECIPE_LEVEL}; llegó {level}."
        )
    return RECIPE_LEVEL_BONUS[level - 1]


def max_sub_skill_slots(level: int) -> int:
    """Cuántas sub skills puede tener un Pokémon de este nivel."""
    return sum(1 for unlock in SUB_SKILL_UNLOCK_LEVELS if level >= unlock)


def max_ingredient_slots(level: int) -> int:
    """Cuántos slots de ingrediente tiene desbloqueados un Pokémon de este nivel."""
    return sum(1 for unlock in INGREDIENT_UNLOCK_LEVELS if level >= unlock)
