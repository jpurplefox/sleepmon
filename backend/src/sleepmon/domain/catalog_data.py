"""Reglas y tablas de referencia del juego (no dependen de ningún Pokémon concreto).

Acá viven:
- el efecto (↑/↓) de cada naturaleza sobre los cinco stats,
- el tier de cada sub skill,
- los niveles en los que se desbloquean slots de sub skill e ingrediente.

Son datos del *juego*, estables, parte del núcleo del dominio.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.value_objects import Nature, NatureStat, SubSkill, SubSkillTier

# Niveles en los que se desbloquean los slots. Actualizado en el último parche:
# las sub skills pasaron a 10/25/50/70/80.
SUB_SKILL_UNLOCK_LEVELS: tuple[int, ...] = (10, 25, 50, 70, 80)
INGREDIENT_UNLOCK_LEVELS: tuple[int, ...] = (1, 30, 60)

MAX_SUB_SKILLS = len(SUB_SKILL_UNLOCK_LEVELS)
MAX_INGREDIENTS = len(INGREDIENT_UNLOCK_LEVELS)
MAX_LEVEL = 100

# Segundos en un día: ventana total sobre la que se estima la producción.
SECONDS_PER_DAY = 86_400
# Reparto día/noche: de noche el inventario no se vacía, así que una vez lleno solo
# se juntan bayas. De día se asume que nunca se llena.
NIGHT_HOURS = 8.5
DAY_HOURS = 24 - NIGHT_HOURS

# La frecuencia de ayuda baja con el nivel (el Pokémon ayuda más rápido): cada nivel
# por encima de 1 resta 0.2% de la frecuencia base -> freq = base * (1 - 0.002*(lvl-1)).
FREQUENCY_REDUCTION_PER_LEVEL = 0.002

# "Pity proc": si pasan SKILL_PITY_HELPS ayudas seguidas sin disparar la main skill,
# la siguiente la dispara sí o sí. Sube la tasa efectiva de skill por encima de la
# base (clave en especies de tasa baja). 78 es el umbral para especialistas de
# ingrediente/baya; para tasas altas el pity casi no incide, así que se usa para todas.
SKILL_PITY_HELPS = 78
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


def max_sub_skill_slots(level: int) -> int:
    """Cuántas sub skills puede tener un Pokémon de este nivel."""
    return sum(1 for unlock in SUB_SKILL_UNLOCK_LEVELS if level >= unlock)


def max_ingredient_slots(level: int) -> int:
    """Cuántos slots de ingrediente tiene desbloqueados un Pokémon de este nivel."""
    return sum(1 for unlock in INGREDIENT_UNLOCK_LEVELS if level >= unlock)
