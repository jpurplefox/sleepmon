"""The chosen map's effects on a member's production (pure).

This is the only place that knows the expert-mode rules. `MapBonuses` describes
the map as the user picked it; `berry_effects` translates it into the five
numbers `daily_production` applies to a specific Pokemon.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.catalog_data import (
    EXPERT_BERRY_MULTIPLIER,
    EXPERT_EXTRA_INGREDIENTS,
    EXPERT_MAIN_SKILL_LEVEL_BONUS,
    EXPERT_MAIN_SPEED_FACTOR,
    EXPERT_PENALTY_SPEED_FACTOR,
    EXPERT_SKILL_RATE_FACTOR,
    FAVORITE_BERRY_MULTIPLIER,
    MAX_FAVORITE_BERRIES,
)
from sleepmon.domain.value_objects import Berry, BerryRole, WeeklyBonus


@dataclass(frozen=True, slots=True)
class MapBonuses:
    """The chosen map, as it touches a member's production.

    On a normal map only the set of favorites matters (the x2) and ``expert``
    is False. On an expert map, ``main`` separates the main berry from the
    sub-favorites, and ``weekly_bonus`` says which of the three is active.
    ``main=None`` with ``expert=True`` is valid: the user hasn't picked a main
    berry yet.
    """

    main: Berry | None = None
    subs: frozenset[Berry] = frozenset()
    expert: bool = False
    weekly_bonus: WeeklyBonus = WeeklyBonus.BERRY_STRENGTH

    def __post_init__(self) -> None:
        # Invariant safeguard: input validation lives in the application layer.
        if self.main is not None and self.main in self.subs:
            raise ValueError("The main berry cannot also be a sub-favorite.")
        if len(self.favorites) > MAX_FAVORITE_BERRIES:
            raise ValueError(
                f"At most {MAX_FAVORITE_BERRIES} favorite berries; "
                f"got {len(self.favorites)}."
            )

    @property
    def favorites(self) -> frozenset[Berry]:
        """The map's favorite berries, main berry included."""
        return self.subs if self.main is None else self.subs | {self.main}

    def role_of(self, berry: Berry) -> BerryRole:
        """What role ``berry`` plays.

        On a normal map this never returns MAIN: without expert mode the main
        berry has no effects of its own, it's just another favorite.
        """
        if self.expert and self.main is not None and berry is self.main:
            return BerryRole.MAIN
        if berry in self.favorites:
            return BerryRole.SUB
        return BerryRole.NONE


@dataclass(frozen=True, slots=True)
class BerryEffects:
    """The five numbers with which the map touches ONE member. Neutral by default."""

    speed_factor: float = 1.0  # x0.9 main berry - x1.15 no favorite
    berry_multiplier: float = 1.0  # 1.0 - 2.0 - 2.4
    skill_level_bonus: int = 0  # +1 with the main berry
    skill_rate_factor: float = 1.0  # x1.25
    extra_ingredients: float = 0.0  # +1 per gather


def berry_effects(bonuses: MapBonuses, berry: Berry) -> BerryEffects:
    """Resolve the four PRD 0007 effects for a species' berry.

    Normal map  -> only ``berry_multiplier`` (2.0 if favorite, 1.0 otherwise).
    Expert map -> MAIN: speed x0.9, skill level +1, plus the weekly bonus.
                  SUB:  only the weekly bonus.
                  NONE: speed x1.15 and nothing else.
    """
    role = bonuses.role_of(berry)

    if not bonuses.expert:
        multiplier = 1.0 if role is BerryRole.NONE else FAVORITE_BERRY_MULTIPLIER
        return BerryEffects(berry_multiplier=multiplier)

    if role is BerryRole.NONE:
        return BerryEffects(speed_factor=EXPERT_PENALTY_SPEED_FACTOR)

    weekly = bonuses.weekly_bonus
    is_main = role is BerryRole.MAIN
    return BerryEffects(
        speed_factor=EXPERT_MAIN_SPEED_FACTOR if is_main else 1.0,
        # The berry-strength bonus REPLACES the x2 favorite bonus; it doesn't stack.
        berry_multiplier=(
            EXPERT_BERRY_MULTIPLIER
            if weekly is WeeklyBonus.BERRY_STRENGTH
            else FAVORITE_BERRY_MULTIPLIER
        ),
        skill_level_bonus=EXPERT_MAIN_SKILL_LEVEL_BONUS if is_main else 0,
        skill_rate_factor=(
            EXPERT_SKILL_RATE_FACTOR if weekly is WeeklyBonus.SKILL_TRIGGER else 1.0
        ),
        extra_ingredients=(
            EXPERT_EXTRA_INGREDIENTS if weekly is WeeklyBonus.INGREDIENT else 0.0
        ),
    )
