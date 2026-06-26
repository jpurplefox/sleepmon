"""Reglas y tablas de referencia del juego (no dependen de ningún Pokémon concreto).

Acá viven:
- el efecto (↑/↓) de cada naturaleza sobre los cinco stats,
- el tier de cada sub skill,
- los niveles en los que se desbloquean slots de sub skill e ingrediente.

Son datos del *juego*, estables, parte del núcleo del dominio.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sleepmon.domain.value_objects import Nature, NatureStat, Ribbon, SubSkill, SubSkillTier

# Niveles en los que se desbloquean los slots. Actualizado en el último parche:
# las sub skills pasaron a 10/25/50/70/80.
SUB_SKILL_UNLOCK_LEVELS: Final[tuple[int, ...]] = (10, 25, 50, 70, 80)
INGREDIENT_UNLOCK_LEVELS: Final[tuple[int, ...]] = (1, 30, 60)

MAX_SUB_SKILLS: Final[int] = len(SUB_SKILL_UNLOCK_LEVELS)
MAX_INGREDIENTS: Final[int] = len(INGREDIENT_UNLOCK_LEVELS)
MAX_LEVEL: Final[int] = 100

# Cada evolución sube el carry limit (inventario base) en una cantidad fija: el
# inventario base del catálogo es el de la forma sin evolucionar y se le suma este
# bonus por cada evolución (una evolución -> +5, dos evoluciones -> +10).
INVENTORY_BONUS_PER_EVOLUTION: Final[int] = 5
# Una especie evoluciona como mucho dos veces (línea de tres formas).
MAX_EVOLUTION_STAGE: Final[int] = 2

# Segundos en un día: ventana total sobre la que se estima la producción.
SECONDS_PER_DAY = 86_400
# Reparto día/noche: de noche el inventario no se vacía, así que una vez lleno solo
# se juntan bayas. De día se asume que nunca se llena.
NIGHT_HOURS = 8.5
DAY_HOURS = 24 - NIGHT_HOURS

# La frecuencia de ayuda baja con el nivel (el Pokémon ayuda más rápido): cada nivel
# por encima de 1 resta 0.2% de la frecuencia base -> freq = base * (1 - 0.002*(lvl-1)).
FREQUENCY_REDUCTION_PER_LEVEL = 0.002

# "Pity proc": si pasan N ayudas seguidas sin disparar la main skill, la siguiente la
# dispara sí o sí. Sube la tasa efectiva de skill por encima de la base (clave en
# especies de tasa baja).
#   - No especialistas en skill (ingrediente/baya): umbral FIJO de 78 ayudas.
#   - Especialistas en SKILL: umbral PROPIO que sale de su frecuencia base —el juego
#     fuerza la skill tras ~140000 s de tiempo base sin activarla, así que el límite
#     en ayudas es 140000 / frecuencia_base (los rápidos toleran más ayudas, los
#     lentos menos). Ver ``Species.pity_helps``.
SKILL_PITY_HELPS = 78
SKILL_SPECIALIST_PITY_SECONDS = 140_000
# Bonus de frecuencia de ayuda por energía máxima. La producción siempre lo asume
# (el Pokémon ayuda 2+2/9 ≈ 2.2222x más rápido que su frecuencia base).
MAX_ENERGY_BONUS = 2 + 2 / 9


@dataclass(frozen=True, slots=True)
class NatureEffect:
    """Stat que la naturaleza sube y stat que baja. ``None`` en ambos si es neutra."""

    increased: NatureStat | None
    decreased: NatureStat | None

    @property
    def is_neutral(self) -> bool:
        return self.increased is None and self.decreased is None


_S = NatureStat

NATURE_EFFECTS: dict[Nature, NatureEffect] = {
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

SUB_SKILL_TIERS: dict[SubSkill, SubSkillTier] = {
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
RIBBON_HOURS: dict[Ribbon, int] = {
    Ribbon.NONE: 0,
    Ribbon.SLEEP_200: 200,
    Ribbon.SLEEP_500: 500,
    Ribbon.SLEEP_1000: 1000,
    Ribbon.SLEEP_2000: 2000,
}
# Aporte INCREMENTAL de cada listón (lo que suma respecto al anterior). El total de
# un listón es la suma de su escalón y los de todos los listones por debajo.
_RIBBON_INVENTORY_STEP: dict[Ribbon, int] = {
    Ribbon.NONE: 0,
    Ribbon.SLEEP_200: 1,
    Ribbon.SLEEP_500: 2,
    Ribbon.SLEEP_1000: 3,
    Ribbon.SLEEP_2000: 2,
}
# Reducción de frecuencia (fracción) que aporta cada listón, según cuántas
# evoluciones le QUEDAN al Pokémon. Solo 500h y 2000h dan velocidad; una forma sin
# evoluciones pendientes (0) no recibe nada.
_RIBBON_SPEED_STEP: dict[Ribbon, dict[int, float]] = {
    Ribbon.SLEEP_500: {1: 0.05, 2: 0.11},
    Ribbon.SLEEP_2000: {1: 0.07, 2: 0.14},
}

# Listones ordenados por horas (ascendente): define qué listones quedan "incluidos"
# al acumular hasta uno dado.
_RIBBON_ORDER: tuple[Ribbon, ...] = tuple(sorted(RIBBON_HOURS, key=lambda r: RIBBON_HOURS[r]))


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


def max_sub_skill_slots(level: int) -> int:
    """Cuántas sub skills puede tener un Pokémon de este nivel."""
    return sum(1 for unlock in SUB_SKILL_UNLOCK_LEVELS if level >= unlock)


def max_ingredient_slots(level: int) -> int:
    """Cuántos slots de ingrediente tiene desbloqueados un Pokémon de este nivel."""
    return sum(1 for unlock in INGREDIENT_UNLOCK_LEVELS if level >= unlock)
