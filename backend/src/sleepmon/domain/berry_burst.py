"""Berry Burst's team half (pure): the berries a burster gets from each teammate.

Runs after every member's daily production is known, because each teammate's berry,
level and slot share decide what the burster's per-teammate count is worth.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from sleepmon.domain.catalog_data import berry_strength_for_level
from sleepmon.domain.map_bonuses import MapBonuses, berry_effects
from sleepmon.domain.production import BerryYield, DailyProduction
from sleepmon.domain.skills import BerryBurstTeam
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Berry

_LATIAS = "Latias"


@dataclass(frozen=True, slots=True)
class BurstMember:
    """A team entry as the team pass sees it."""

    id: str
    slot: int  # members sharing a slot are never on the team together
    species: Species
    level: int
    weight: float  # the entry's share of its slot
    daily: DailyProduction  # already scaled by ``weight``


def berry_burst_team_for(
    slot: int, species: Species, roster: Sequence[tuple[int, Species]]
) -> BerryBurstTeam:
    """Team context for the entry in ``slot``: other slots plus itself.

    Species sharing a berry share a type, so for Latios these are the Dragon species.
    """
    others = [other for other_slot, other in roster if other_slot != slot]
    same_berry = {other.name for other in others if other.berry is species.berry}
    same_berry.add(species.name)
    return BerryBurstTeam(
        same_berry_species=len(same_berry),
        latias=any(other.name == _LATIAS for other in others),
    )


def teammate_berries(
    members: Sequence[BurstMember], map_bonuses: MapBonuses
) -> dict[str, tuple[BerryYield, ...]]:
    """Berries each burster gets from teammates in other slots, merged by berry."""
    result: dict[str, tuple[BerryYield, ...]] = {}
    for burster in members:
        per_teammate = burster.daily.skill_berries_per_teammate
        if per_teammate is None:
            continue
        totals: dict[Berry, tuple[float, float]] = {}
        for mate in members:
            if mate.slot == burster.slot:
                continue
            berry = mate.species.berry
            per_berry = berry_strength_for_level(
                berry, mate.level, multiplier=berry_effects(map_bonuses, berry).berry_multiplier
            )
            amount = per_teammate * mate.weight
            prev_amount, prev_strength = totals.get(berry, (0.0, 0.0))
            totals[berry] = (prev_amount + amount, prev_strength + amount * per_berry)
        yields = (BerryYield(b, a, s) for b, (a, s) in totals.items())
        result[burster.id] = tuple(sorted(yields, key=lambda y: y.strength, reverse=True))
    return result
