"""A hand-built game event's effects on production (pure).

The only place that knows the event rules: `EventBonus` describes the effects as
the user composed them; `boosts_for` turns them into the numbers one member uses.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final

from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Specialty, Type


class EventEffectKind(StrEnum):
    EXTRA_INGREDIENTS = "extra_ingredients"
    EXTRA_BERRIES = "extra_berries"
    SKILL_INGREDIENTS = "skill_ingredients"
    SKILL_TRIGGER = "skill_trigger"
    SKILL_LEVEL = "skill_level"
    CARRY_LIMIT = "carry_limit"
    DISH_STRENGTH = "dish_strength"
    POT_SIZE = "pot_size"


# PRD 0012 "Allowed values".
ADDITIVE_RANGES: Final[dict[EventEffectKind, tuple[int, int]]] = {
    EventEffectKind.EXTRA_INGREDIENTS: (1, 5),
    EventEffectKind.EXTRA_BERRIES: (1, 5),
    EventEffectKind.SKILL_LEVEL: (1, 5),
    EventEffectKind.CARRY_LIMIT: (1, 50),
}
TEAM_WIDE_KINDS: Final[frozenset[EventEffectKind]] = frozenset(
    {EventEffectKind.DISH_STRENGTH, EventEffectKind.POT_SIZE}
)
FACTOR_MIN: Final[float] = 1.05
FACTOR_MAX: Final[float] = 3.0
FACTOR_STEP: Final[float] = 0.05
_STEP_EPS = 1e-6


@dataclass(frozen=True, slots=True)
class EventScope:
    """Whole team when both are None; at most one is set."""

    type: Type | None = None
    specialty: Specialty | None = None

    def __post_init__(self) -> None:
        if self.type is not None and self.specialty is not None:
            raise ValueError("An event scope is a type or a specialty, not both.")

    @property
    def is_team(self) -> bool:
        return self.type is None and self.specialty is None

    def reaches(self, species: Species) -> bool:
        if self.type is not None:
            return species.type is self.type
        if self.specialty is not None:
            # An "All" specialist counts as a specialist of every kind.
            return species.specialty in (self.specialty, Specialty.ALL)
        return True


@dataclass(frozen=True, slots=True)
class EventEffect:
    kind: EventEffectKind
    value: float
    scope: EventScope = field(default_factory=EventScope)

    def __post_init__(self) -> None:
        # Invariant safeguard: input validation lives in the application layer.
        if self.kind in ADDITIVE_RANGES:
            low, high = ADDITIVE_RANGES[self.kind]
            if self.value != int(self.value) or not low <= self.value <= high:
                raise ValueError(f"{self.kind} must be a whole number in {low}..{high}.")
        else:
            steps = (self.value - FACTOR_MIN) / FACTOR_STEP
            on_step = abs(steps - round(steps)) < _STEP_EPS
            if not (FACTOR_MIN - _STEP_EPS <= self.value <= FACTOR_MAX + _STEP_EPS and on_step):
                raise ValueError(
                    f"{self.kind} must be in {FACTOR_MIN}..{FACTOR_MAX} by {FACTOR_STEP}."
                )
        if self.kind in TEAM_WIDE_KINDS and not self.scope.is_team:
            raise ValueError(f"{self.kind} applies to the whole team; it takes no scope.")


@dataclass(frozen=True, slots=True)
class MemberBoosts:
    """What the event does to ONE member. Neutral by default."""

    extra_ingredients: int = 0
    extra_berries: int = 0
    skill_ingredient_factor: float = 1.0
    skill_rate_factor: float = 1.0
    skill_level_bonus: int = 0
    carry_limit_bonus: int = 0


@dataclass(frozen=True, slots=True)
class EventBonus:
    effects: tuple[EventEffect, ...] = ()

    def _sum(self, kind: EventEffectKind, species: Species) -> int:
        return sum(
            int(e.value) for e in self.effects if e.kind is kind and e.scope.reaches(species)
        )

    def _product(self, kind: EventEffectKind, species: Species | None = None) -> float:
        return math.prod(
            e.value
            for e in self.effects
            if e.kind is kind and (species is None or e.scope.reaches(species))
        )

    def boosts_for(self, species: Species) -> MemberBoosts:
        """+N effects add up; ×X effects multiply (PRD 0012 stacking)."""
        return MemberBoosts(
            extra_ingredients=self._sum(EventEffectKind.EXTRA_INGREDIENTS, species),
            extra_berries=self._sum(EventEffectKind.EXTRA_BERRIES, species),
            skill_ingredient_factor=self._product(EventEffectKind.SKILL_INGREDIENTS, species),
            skill_rate_factor=self._product(EventEffectKind.SKILL_TRIGGER, species),
            skill_level_bonus=self._sum(EventEffectKind.SKILL_LEVEL, species),
            carry_limit_bonus=self._sum(EventEffectKind.CARRY_LIMIT, species),
        )

    @property
    def dish_strength_factor(self) -> float:
        return self._product(EventEffectKind.DISH_STRENGTH)

    @property
    def pot_factor(self) -> float:
        return self._product(EventEffectKind.POT_SIZE)


NO_EVENT: Final = EventBonus()
