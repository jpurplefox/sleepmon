"""Cálculo de caramelos y fragmentos de sueño para subir de nivel.

Simulación caramelo-a-caramelo sobre tablas exactas del juego: cada caramelo
aporta EXP según la banda del nivel actual y cuesta fragmentos según ese mismo
nivel; el excedente de EXP arrastra al siguiente nivel.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import CandyBoost, ExpNatureModifier, GrowthCurve

# EXP para pasar de nivel L a L+1, índice = L-1 (L=1..54). Fuente: game8.
NORMAL_EXP_TO_NEXT: Final[tuple[int, ...]] = (
    54, 71, 108, 128, 164, 202, 244, 274, 315, 345,
    376, 407, 419, 429, 440, 454, 469, 483, 497, 515,
    537, 558, 579, 600, 622, 643, 665, 686, 708, 729,
    748, 766, 785, 803, 821, 839, 857, 875, 893, 910,
    928, 945, 963, 980, 997, 1015, 1032, 1049, 1066, 1362,
    1562, 1747, 1946, 2195,
)

# Fragmentos por caramelo gastado en el nivel L, índice = L-1 (L=1..59). Fuente: Serebii.
DREAM_SHARDS_PER_CANDY: Final[tuple[int, ...]] = (
    14, 18, 22, 27, 30, 34, 39, 44, 48, 50,
    52, 53, 56, 59, 62, 66, 68, 71, 74, 78,
    81, 85, 88, 92, 95, 100, 105, 111, 117, 122,
    126, 130, 136, 143, 151, 160, 167, 174, 184, 192,
    201, 211, 221, 227, 236, 250, 264, 279, 295, 309,
    323, 338, 356, 372, 391, 437, 486, 538, 593,
)

MAX_LEVELABLE_LEVEL: Final[int] = len(NORMAL_EXP_TO_NEXT) + 1  # 55

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

# (exp multiplier, shard multiplier) por modo de boost.
_BOOST_FACTORS: Final[dict[CandyBoost, tuple[int, int]]] = {
    CandyBoost.NONE: (1, 1),
    CandyBoost.FULL: (2, 5),
    CandyBoost.MINI: (2, 4),
}
_MINI_BOOST_CAP: Final[int] = 350


@dataclass(frozen=True, slots=True)
class LevelUpCost:
    """Costo de subir de `current_level` a `target_level`."""

    current_level: int
    target_level: int
    total_exp: int
    candies: int
    dream_shards: int
    boosted_candies: int


def _r(x: float) -> int:
    """Redondeo half-up para valores positivos."""
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
    boost: CandyBoost = CandyBoost.NONE,
) -> LevelUpCost:
    if current_level < 1:
        raise ValidationError(
            f"El nivel actual debe ser al menos 1; llegó {current_level}."
        )
    if target_level > MAX_LEVELABLE_LEVEL:
        raise ValidationError(
            f"El nivel objetivo no puede superar {MAX_LEVELABLE_LEVEL}; "
            f"llegó {target_level}."
        )
    if current_level >= target_level:
        raise ValidationError(
            "El nivel objetivo debe ser mayor que el actual; "
            f"llegó actual={current_level}, objetivo={target_level}."
        )

    curve_mult = _CURVE_MULTIPLIER[curve]
    nature_mult = _NATURE_MULTIPLIER[nature]
    exp_factor, shard_factor = _BOOST_FACTORS[boost]

    total_exp = 0
    candies = 0
    dream_shards = 0
    boosted_candies = 0
    carry = 0  # EXP arrastrada al nivel siguiente

    for level in range(current_level, target_level):
        exp_to_next = _r(NORMAL_EXP_TO_NEXT[level - 1] * curve_mult)
        total_exp += exp_to_next
        progress = carry
        while progress < exp_to_next:
            per_candy = _r(_exp_per_candy_base(level) * nature_mult)
            shard = DREAM_SHARDS_PER_CANDY[level - 1]
            apply_boost = boost is not CandyBoost.NONE and not (
                boost is CandyBoost.MINI and boosted_candies >= _MINI_BOOST_CAP
            )
            if apply_boost:
                per_candy *= exp_factor
                shard *= shard_factor
                boosted_candies += 1
            candies += 1
            dream_shards += shard
            progress += per_candy
        carry = progress - exp_to_next

    return LevelUpCost(
        current_level=current_level,
        target_level=target_level,
        total_exp=total_exp,
        candies=candies,
        dream_shards=dream_shards,
        boosted_candies=boosted_candies,
    )
