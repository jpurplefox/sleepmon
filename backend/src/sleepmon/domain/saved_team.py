"""Saved teams: a named line-up of Box entries, plus its map and meals (PRD 0016).

A saved team records *which* Box entries sit in which slots and at which weights; it
never holds its own copy of a Pokémon. The rules here are the ones that hold for any
team regardless of storage: the name, the slot shape and the split shares. Whether a
member really is one of the user's Box entries, or a meal a real recipe, is checked
by the application against its ports.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Final
from uuid import UUID

from sleepmon.domain.catalog_data import MAX_FAVORITE_BERRIES
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Berry, Island, RecipeType, WeeklyBonus

MAX_NAME_LENGTH: Final[int] = 40
MAX_SLOTS: Final[int] = 5
MAX_SLOT_MEMBERS: Final[int] = 2
MEALS_PER_TEAM: Final[int] = 3
SINGLE_SHARE: Final[float] = 1.0

Meals = tuple[str | None, str | None, str | None]


def normalize_name(raw: str) -> str:
    """Surrounding spaces are not part of a name."""
    return raw.strip()


def name_key(name: str) -> str:
    """What two names are compared by: trimmed and case-insensitive.

    ``lower()`` (not ``casefold()``) so it matches the database's ``lower(name)``
    unique index exactly.
    """
    return normalize_name(name).lower()


def validate_name(raw: str) -> str:
    """Return the normalized name, or raise if it breaks the name rules."""
    name = normalize_name(raw)
    if not name:
        raise ValidationError("El nombre del equipo no puede estar vacío.")
    if len(name) > MAX_NAME_LENGTH:
        raise ValidationError(f"El nombre del equipo admite hasta {MAX_NAME_LENGTH} caracteres.")
    return name


def duplicate_name_error(name: str) -> ValidationError:
    """The one error for a name another team of the same user already has."""
    return ValidationError(f"Ya tenés un equipo llamado «{name}».")


@dataclass(frozen=True, slots=True)
class SavedSlot:
    """One slot: a single Box entry, or a split of two.

    ``share`` is the FIRST member's time share. A single-member slot always has the
    whole slot, so its share is normalized to 1.0 rather than rejected; a split must
    give each member a real part of it (0 < share < 1).
    """

    members: tuple[UUID, ...]
    share: float = SINGLE_SHARE

    def __post_init__(self) -> None:
        if not 1 <= len(self.members) <= MAX_SLOT_MEMBERS:
            raise ValidationError("Cada slot lleva uno o dos Pokémon.")
        if len(self.members) == 1:
            object.__setattr__(self, "share", SINGLE_SHARE)
            return
        if not (math.isfinite(self.share) and 0 < self.share < 1):
            raise ValidationError(
                "El reparto de un slot compartido debe estar entre 0 y 1 (sin incluirlos)."
            )


@dataclass(frozen=True, slots=True)
class SavedTeam:
    """A named line-up. The name is stored normalized (trimmed)."""

    id: UUID
    name: str
    slots: tuple[SavedSlot, ...]
    island: Island | None
    favorite_berries: tuple[Berry, ...]
    main_favorite: Berry | None
    weekly_bonus: WeeklyBonus
    dish_type: RecipeType | None
    meals: Meals
    saved_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "name", validate_name(self.name))
        if not self.slots:
            raise ValidationError("Un equipo necesita al menos un Pokémon.")
        if len(self.slots) > MAX_SLOTS:
            raise ValidationError(f"Un equipo tiene como máximo {MAX_SLOTS} slots.")
        if len(self.favorite_berries) > MAX_FAVORITE_BERRIES:
            raise ValidationError(f"Como máximo {MAX_FAVORITE_BERRIES} bayas favoritas.")
        if len(set(self.favorite_berries)) != len(self.favorite_berries):
            raise ValidationError("Las bayas favoritas no pueden repetirse.")
        if len(self.meals) != MEALS_PER_TEAM:
            raise ValidationError(f"Un equipo lleva exactamente {MEALS_PER_TEAM} comidas.")

    @property
    def member_ids(self) -> frozenset[UUID]:
        """Every distinct Box entry the team holds, in any slot."""
        return frozenset(m for slot in self.slots for m in slot.members)


def contains(team: SavedTeam, member_id: UUID) -> bool:
    """Whether the Box entry sits anywhere in the team, single or split."""
    return any(member_id in slot.members for slot in team.slots)


def without_member(team: SavedTeam, member_id: UUID) -> SavedTeam | None:
    """The team once ``member_id`` leaves the Box; ``None`` when nothing would remain.

    - a single slot holding it goes;
    - a split holding it keeps the other member, at the whole slot (share 1.0);
    - a split holding it in both halves goes;
    - a team left with no slots must be deleted (``None``): a saved team is never empty.

    Pure; a team that does not hold the member is returned unchanged. ``saved_at`` is
    kept: the user did not save anything.
    """
    if not contains(team, member_id):
        return team
    slots: list[SavedSlot] = []
    for slot in team.slots:
        if member_id not in slot.members:
            slots.append(slot)
            continue
        remaining = [m for m in slot.members if m != member_id]
        if remaining:
            slots.append(SavedSlot((remaining[0],), SINGLE_SHARE))
    if not slots:
        return None
    return replace(team, slots=tuple(slots))
