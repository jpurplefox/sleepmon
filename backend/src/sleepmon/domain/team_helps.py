"""The team half of skills that grant helps (pure): what those helps bring.

Each trigger grants ``targets`` random team members, the user included, xN their usual
help (Extra Helpful: one; Heal Pulse: two; Helper Boost: everyone). On average every
occupied slot gets ``min(targets, slots) / slots`` of it; inside a split slot each
entry gets its weight of that. What those helps bring is credited to the skill's
owner, like Berry Burst's teammate berries.
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
    own_ingredients: tuple[SlotProduction, ...]
    teammate_berries: tuple[BerryYield, ...]  # merged by berry, strongest first
    teammate_ingredients: tuple[SlotProduction, ...]  # merged by ingredient


def _add_ingredients(
    totals: dict[Ingredient, float], slots: tuple[SlotProduction, ...], helps: float
) -> None:
    for slot in slots:
        totals[slot.ingredient] = totals.get(slot.ingredient, 0.0) + helps * slot.amount


def extra_help_yields(members: Sequence[BurstMember]) -> dict[str, HelpedYields]:
    """Yields of the helps each member's skill grants, keyed by its id."""
    occupied = len({m.slot for m in members})
    result: dict[str, HelpedYields] = {}
    for helper in members:
        grant = helper.daily.help_grant
        if grant is None:
            continue
        per_slot = grant.per_target * min(grant.targets, occupied) / occupied
        own = helper.daily.help_yield
        berries: dict[Berry, tuple[float, float]] = {}
        ingredients: dict[Ingredient, float] = {}
        # Its own slot is always itself: a split partner is never on the team with it.
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
            own_ingredients=tuple(
                SlotProduction(s.ingredient, per_slot * s.amount) for s in own.ingredients
            ),
            teammate_berries=tuple(sorted(yields, key=lambda y: y.strength, reverse=True)),
            teammate_ingredients=tuple(SlotProduction(i, a) for i, a in ingredients.items()),
        )
    return result
