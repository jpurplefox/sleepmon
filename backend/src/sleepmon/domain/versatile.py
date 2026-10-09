"""Mew's "Versatile" main skill: each Mew carries one skill out of a fixed list.

The chosen skill replaces the species' main skill for production, and it sets the
skill rate (pks.raenonx.cc, via nitoyon's pokesleep-tool).
"""

from __future__ import annotations

from dataclasses import replace
from typing import Final

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.species import Species

VERSATILE: Final = "Versatile"

VERSATILE_SKILLS: Final[tuple[str, ...]] = (
    "Charge Strength S (Random)",
    "Charge Strength M",
    "Dream Shard Magnet S (Random)",
    "Ingredient Magnet S",
    "Charge Energy S",
    "Energizing Cheer S",
    "Energy for Everyone S",
    "Tasty Chance S",
    "Cooking Power-Up S",
    "Extra Helpful S",
    "Metronome",
    "Berry Burst",
)

# A new Mew starts with Metronome.
DEFAULT_VERSATILE_SKILL: Final = "Metronome"

# Skill rate (%) per chosen skill; the rest use the species' base rate.
_SKILL_RATES: Final[dict[str, float]] = {
    "Charge Strength S (Random)": 6.4,
    "Charge Energy S": 6.4,
    "Energizing Cheer S": 4.39,
    "Energy for Everyone S": 3.37,
    "Berry Burst": 2.84,
}


def resolve_versatile(species: Species, skill: str | None) -> Species:
    """The species as production sees it: Mew with its chosen skill and rate.

    ``skill`` is ``None`` (or empty) for no choice; only a Versatile species takes one.
    """
    if species.main_skill != VERSATILE:
        if skill:
            raise ValidationError(f"{species.name} no elige su habilidad principal.")
        return species
    chosen = skill or DEFAULT_VERSATILE_SKILL
    if chosen not in VERSATILE_SKILLS:
        raise ValidationError(f"{chosen!r} no es una habilidad posible de {species.name}.")
    return replace(
        species,
        main_skill=chosen,
        skill_percentage=_SKILL_RATES.get(chosen, species.skill_percentage),
    )
