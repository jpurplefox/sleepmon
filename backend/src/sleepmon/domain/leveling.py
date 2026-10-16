"""Candies and dream shards to level a Pokémon up (PRD 0021).

Candy-by-candy simulation over the game's tables: each candy gives EXP by the level it
is spent at (banded, adjusted by nature) and costs that level's dream-shard price; the
EXP a candy leaves over carries into the next level. Verified in game: a level-23
neutral Pokémon takes 15 candies (600 EXP, 21 carried) and 1,320 shards to reach 24.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sleepmon.domain.catalog_data import (
    INGREDIENT_UNLOCK_LEVELS,
    NATURE_EFFECTS,
    SUB_SKILL_UNLOCK_LEVELS,
)
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import ExpNatureModifier, GrowthCurve, Nature, NatureStat

# EXP to go from level L to L+1, index = L-1 (L=1..69). Source: game8 / RaenonX.
NORMAL_EXP_TO_NEXT: Final[tuple[int, ...]] = (
    54, 71, 108, 128, 164, 202, 244, 274, 315, 345,
    376, 407, 419, 429, 440, 454, 469, 483, 497, 515,
    537, 558, 579, 600, 622, 643, 665, 686, 708, 729,
    748, 766, 785, 803, 821, 839, 857, 875, 893, 910,
    928, 945, 963, 980, 997, 1015, 1032, 1049, 1066, 1362,
    1562, 1747, 1946, 2195, 2279, 2404, 2533, 2666, 2806, 2865,
    2922, 2977, 3029, 3077, 3095, 3116, 3144, 3189, 3255,
)

# Dream shards per candy spent at level L, index = L-1 (L=1..69). Source: Serebii / RaenonX.
DREAM_SHARDS_PER_CANDY: Final[tuple[int, ...]] = (
    14, 18, 22, 27, 30, 34, 39, 44, 48, 50,
    52, 53, 56, 59, 62, 66, 68, 71, 74, 78,
    81, 85, 88, 92, 95, 100, 105, 111, 117, 122,
    126, 130, 136, 143, 151, 160, 167, 174, 184, 192,
    201, 211, 221, 227, 236, 250, 264, 279, 295, 309,
    323, 338, 356, 372, 391, 437, 486, 538, 593, 651,
    698, 750, 804, 866, 932, 1004, 1084, 1173, 1272,
)


MAX_LEVELABLE_LEVEL: Final[int] = len(NORMAL_EXP_TO_NEXT) + 1  # 70

# Levels a target lands on: every unlock above level 1 that the tables reach.
LEVEL_UP_TARGETS: Final[tuple[int, ...]] = tuple(
    sorted(
        {
            lv
            for lv in (*SUB_SKILL_UNLOCK_LEVELS, *INGREDIENT_UNLOCK_LEVELS)
            if 1 < lv <= MAX_LEVELABLE_LEVEL
        }
    )
)

_CURVE_MULTIPLIER: Final[dict[GrowthCurve, float]] = {
    GrowthCurve.NORMAL: 1.0,
    GrowthCurve.PSEUDO_LEGENDARY: 1.5,
    GrowthCurve.LEGENDARY: 1.8,
    GrowthCurve.MYTHICAL: 2.2,
}

_NATURE_MULTIPLIER: Final[dict[ExpNatureModifier, float]] = {
    ExpNatureModifier.NEUTRAL: 1.0,
    ExpNatureModifier.UP: 1.2,
    ExpNatureModifier.DOWN: 0.84,
}


@dataclass(frozen=True, slots=True)
class LevelUpCost:
    """Species candies and dream shards from ``current_level`` to ``target_level``."""

    current_level: int
    target_level: int
    candies: int
    dream_shards: int


def _round_half_up(x: float) -> int:
    # Not round(): banker's rounding would shift EXP on .5 boundaries.
    return int(x + 0.5)


def _exp_per_candy_base(level: int) -> int:
    if level <= 24:
        return 40
    if level <= 29:
        return 35
    return 25


def level_up_cost(
    current_level: int,
    target_level: int,
    *,
    curve: GrowthCurve = GrowthCurve.NORMAL,
    nature: ExpNatureModifier = ExpNatureModifier.NEUTRAL,
) -> LevelUpCost:
    if current_level < 1:
        raise ValidationError(f"El nivel actual debe ser al menos 1; llegó {current_level}.")
    if target_level > MAX_LEVELABLE_LEVEL:
        raise ValidationError(
            f"El nivel objetivo no puede superar {MAX_LEVELABLE_LEVEL}; llegó {target_level}."
        )
    if current_level >= target_level:
        raise ValidationError(
            "El nivel objetivo debe ser mayor que el actual; "
            f"llegó actual={current_level}, objetivo={target_level}."
        )

    curve_mult = _CURVE_MULTIPLIER[curve]
    nature_mult = _NATURE_MULTIPLIER[nature]
    candies = 0
    shards = 0
    carry = 0  # EXP carried into the next level
    for level in range(current_level, target_level):
        needed = _round_half_up(NORMAL_EXP_TO_NEXT[level - 1] * curve_mult)
        per_candy = _round_half_up(_exp_per_candy_base(level) * nature_mult)
        progress = carry
        while progress < needed:
            candies += 1
            shards += DREAM_SHARDS_PER_CANDY[level - 1]
            progress += per_candy
        carry = progress - needed
    return LevelUpCost(current_level, target_level, candies, shards)


def target_level(level: int, minimum: int | None) -> int | None:
    """The level a Box entry's cost aims at, or ``None`` past the tables (70+)."""
    if level >= MAX_LEVELABLE_LEVEL:
        return None
    if minimum is not None and level < minimum:
        return minimum
    return next(t for t in LEVEL_UP_TARGETS if t > level)


def exp_modifier(nature: Nature | None) -> ExpNatureModifier:
    """Whether a nature raises or lowers the EXP each candy gives."""
    if nature is None:
        return ExpNatureModifier.NEUTRAL
    effect = NATURE_EFFECTS[nature]
    if effect.increased is NatureStat.EXP_GAINS:
        return ExpNatureModifier.UP
    if effect.decreased is NatureStat.EXP_GAINS:
        return ExpNatureModifier.DOWN
    return ExpNatureModifier.NEUTRAL
