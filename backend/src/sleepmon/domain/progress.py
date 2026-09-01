"""Player progress: what the user has unlocked in the game (PRD 0011).

The pot step, the level of each recipe, one favorite recipe per dish type, and the
bonus of each research area. Facts about an account that only ever move forward.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Final

from sleepmon.domain.catalog_data import (
    DEFAULT_POT_SIZE,
    MAX_AREA_BONUS_PCT,
    MAX_RECIPE_LEVEL,
    POT_LADDER,
)
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Island, RecipeType

DEFAULT_RECIPE_LEVEL: Final[int] = 1
DEFAULT_AREA_BONUS: Final[int] = 0


def _require_int(value: int, what: str) -> None:
    """bool is a subtype of int (True == 1), so reject it explicitly."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError(f"{what} debe ser un entero; llegó {value!r}.")


def validate_pot_size(size: int) -> None:
    """The pot climbs a fixed ladder; a value between two rungs is unreachable."""
    _require_int(size, "El tamaño de olla")
    if size not in POT_LADDER:
        raise ValidationError(
            f"El tamaño de olla debe ser uno de los escalones del juego; llegó {size}."
        )


def validate_recipe_level(level: int) -> None:
    _require_int(level, "El nivel de receta")
    if not DEFAULT_RECIPE_LEVEL <= level <= MAX_RECIPE_LEVEL:
        raise ValidationError(
            f"El nivel de receta debe estar entre {DEFAULT_RECIPE_LEVEL} y "
            f"{MAX_RECIPE_LEVEL}; llegó {level}."
        )


def validate_area_bonus(pct: int) -> None:
    """Percentage points, not a fraction: the analysis converts at its own edge."""
    _require_int(pct, "El bonus de área")
    if not DEFAULT_AREA_BONUS <= pct <= MAX_AREA_BONUS_PCT:
        raise ValidationError(
            f"El bonus de área debe estar entre {DEFAULT_AREA_BONUS} y "
            f"{MAX_AREA_BONUS_PCT}; llegó {pct}."
        )


@dataclass(frozen=True, slots=True)
class PlayerProgress:
    """One user's progress. Every mapping holds only what differs from the default."""

    pot_size: int = DEFAULT_POT_SIZE
    recipe_levels: Mapping[str, int] = field(default_factory=dict)
    favorite_recipes: Mapping[RecipeType, str] = field(default_factory=dict)
    area_bonuses: Mapping[Island, int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        validate_pot_size(self.pot_size)
        for level in self.recipe_levels.values():
            validate_recipe_level(level)
        for pct in self.area_bonuses.values():
            validate_area_bonus(pct)


@dataclass(frozen=True, slots=True)
class ProgressPatch:
    """A sparse change: a field left ``None`` is untouched.

    Inside a mapping, a value at its default removes the key — a recipe level of 1,
    an area bonus of 0, a favorite of ``None``.
    """

    pot_size: int | None = None
    recipe_levels: Mapping[str, int] | None = None
    favorite_recipes: Mapping[RecipeType, str | None] | None = None
    area_bonuses: Mapping[Island, int] | None = None


def apply_patch(current: PlayerProgress, patch: ProgressPatch) -> PlayerProgress:
    """Merge ``patch`` into ``current``, pruning anything back at its default.

    Pure: ``current`` is never mutated. Being the only writer, it is also what keeps
    what reaches the database canonical.
    """
    pot = current.pot_size if patch.pot_size is None else patch.pot_size

    levels = dict(current.recipe_levels)
    for name, level in (patch.recipe_levels or {}).items():
        validate_recipe_level(level)
        if level == DEFAULT_RECIPE_LEVEL:
            levels.pop(name, None)
        else:
            levels[name] = level

    favorites = dict(current.favorite_recipes)
    for dish_type, recipe in (patch.favorite_recipes or {}).items():
        if recipe is None:
            favorites.pop(dish_type, None)
        else:
            favorites[dish_type] = recipe

    bonuses = dict(current.area_bonuses)
    for area, pct in (patch.area_bonuses or {}).items():
        validate_area_bonus(pct)
        if pct == DEFAULT_AREA_BONUS:
            bonuses.pop(area, None)
        else:
            bonuses[area] = pct

    return PlayerProgress(pot, levels, favorites, bonuses)
