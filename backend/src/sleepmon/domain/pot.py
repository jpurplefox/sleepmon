"""The day's cooking pot (pure)."""

from __future__ import annotations

import math
from dataclasses import dataclass

_MEALS_PER_DAY = 3


@dataclass(frozen=True, slots=True)
class PotCapacity:
    """One day's pot, as the cooking plan uses it."""

    per_meal: int
    skill_per_meal: int  # floor(skill expansion / 3): what the stepper readout adds
    daily: float
    base_daily: int
    skill_daily: float
    bonus_daily: float  # what multipliers (camp ticket, event) add on top


def pot_capacity(pot_size: int, skill_expansion: float, multiplier: float = 1.0) -> PotCapacity:
    """Without a multiplier the skill expansion adds once per day; with one, each
    meal's pot (base + its skill share) is multiplied and rounded up."""
    if pot_size <= 0:
        raise ValueError(f"Pot size must be positive; got {pot_size}.")
    if skill_expansion < 0:
        raise ValueError(f"Skill expansion cannot be negative; got {skill_expansion}.")
    if multiplier < 1.0:
        raise ValueError(f"Pot multiplier must be >= 1; got {multiplier}.")

    base_daily = pot_size * _MEALS_PER_DAY
    skill_per_meal = math.floor(skill_expansion / _MEALS_PER_DAY)
    if multiplier == 1.0:
        return PotCapacity(
            per_meal=pot_size + skill_per_meal,
            skill_per_meal=skill_per_meal,
            daily=base_daily + skill_expansion,
            base_daily=base_daily,
            skill_daily=skill_expansion,
            bonus_daily=0.0,
        )
    # Same expression order as the former frontend, so float rounding matches.
    per_meal = math.ceil((pot_size + skill_expansion / _MEALS_PER_DAY) * multiplier)
    daily = float(per_meal * _MEALS_PER_DAY)
    return PotCapacity(
        per_meal=per_meal,
        skill_per_meal=skill_per_meal,
        daily=daily,
        base_daily=base_daily,
        skill_daily=skill_expansion,
        bonus_daily=daily - base_daily - skill_expansion,
    )
