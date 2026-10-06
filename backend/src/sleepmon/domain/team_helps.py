"""Extra Helpful S's team half (pure): what the helps it grants bring.

Each trigger grants a random team member, the user included, xN its usual help. On
average every occupied slot gets the same share; inside a split slot each entry gets
its weight of it. What those helps bring is credited to the skill's owner, like
Berry Burst's teammate berries.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from sleepmon.domain.berry_burst import BurstMember
from sleepmon.domain.production import BerryYield, SlotProduction
from sleepmon.domain.value_objects import Berry, Ingredient


@dataclass(frozen=True, slots=True)
class HelpedYields:
    """What one member's granted helps bring per day."""

    own_berries: float  # from the helps it granted itself
    own_berry_strength: float
    teammate_berries: tuple[BerryYield, ...]  # merged by berry, strongest first
    ingredients: tuple[SlotProduction, ...]  # merged by ingredient, self included


def _add_ingredients(
    totals: dict[Ingredient, float], slots: tuple[SlotProduction, ...], helps: float
) -> None:
    for slot in slots:
        totals[slot.ingredient] = totals.get(slot.ingredient, 0.0) + helps * slot.amount


def extra_help_yields(members: Sequence[BurstMember]) -> dict[str, HelpedYields]:
    """Yields of the helps each Extra Helpful member grants, keyed by its id."""
    occupied = len({m.slot for m in members})
    result: dict[str, HelpedYields] = {}
    for helper in members:
        granted = helper.daily.skill_extra_helpful
        if granted is None:
            continue
        per_slot = granted / occupied
        own = helper.daily.help_yield
        berries: dict[Berry, tuple[float, float]] = {}
        ingredients: dict[Ingredient, float] = {}
        # Its own slot is always itself: a split partner is never on the team with it.
        _add_ingredients(ingredients, own.ingredients, per_slot)
        for mate in members:
            if mate.slot == helper.slot:
                continue
            helps = per_slot * mate.weight
            y = mate.daily.help_yield
            prev_amount, prev_strength = berries.get(mate.species.berry, (0.0, 0.0))
            berries[mate.species.berry] = (
                prev_amount + helps * y.berries,
                prev_strength + helps * y.berry_strength,
            )
            _add_ingredients(ingredients, y.ingredients, helps)

        yields = (BerryYield(b, a, s) for b, (a, s) in berries.items())
        result[helper.id] = HelpedYields(
            own_berries=per_slot * own.berries,
            own_berry_strength=per_slot * own.berry_strength,
            teammate_berries=tuple(sorted(yields, key=lambda y: y.strength, reverse=True)),
            ingredients=tuple(SlotProduction(i, a) for i, a in ingredients.items()),
        )
    return result
