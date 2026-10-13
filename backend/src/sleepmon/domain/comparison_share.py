"""Shared comparisons (PRD 0020): a frozen copy of a comparison, reachable by a link.

Anyone can create one (signed out behind a human check); it expires 90 days after
it was last opened.

A share holds its own copy of each card's config and of the map terms, plus the
image the sharer's device rendered of the cards side by side. It never points at
the sharer's Box: editing or deleting a Box entry later doesn't touch it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Final

from sleepmon.domain.catalog_data import ISLAND_EXPERT, MAX_FAVORITE_BERRIES
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.sleep import SleepSchedule
from sleepmon.domain.value_objects import Berry, Island, WeeklyBonus

MAX_SHARED_CARDS: Final[int] = 5
MAX_SHARE_IMAGE_BYTES: Final[int] = 500_000
# A share stays reachable while people keep opening it: 90 days after the last opening.
SHARE_TTL: Final[timedelta] = timedelta(days=90)
# Formats every link-preview crawler renders; checked by signature, not by the
# media type the client claims.
_IMAGE_SIGNATURES: Final[dict[str, bytes]] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
}


class ShareLanguage(StrEnum):
    """The sharer's UI language: the link preview's title and text follow it."""

    ES = "es"
    EN = "en"


@dataclass(frozen=True, slots=True)
class ShareImage:
    media_type: str
    data: bytes = field(repr=False)

    def __post_init__(self) -> None:
        signature = _IMAGE_SIGNATURES.get(self.media_type)
        if signature is None:
            raise ValidationError("La imagen tiene que ser JPEG o PNG.")
        if not self.data.startswith(signature):
            raise ValidationError("La imagen no se pudo leer.")
        if len(self.data) > MAX_SHARE_IMAGE_BYTES:
            raise ValidationError("La imagen es demasiado grande.")


@dataclass(frozen=True, slots=True)
class SharedMap:
    """The comparison's map terms: Normal (no island) or an expert map.

    ``favorites`` keeps the three positional slots as the sharer left them (``None``
    is an open slot): on an expert map slot 1 is the main favorite.
    """

    island: Island | None = None
    favorites: tuple[Berry | None, ...] = ()
    weekly_bonus: WeeklyBonus = WeeklyBonus.BERRY_STRENGTH

    def __post_init__(self) -> None:
        if self.island is not None and self.island not in ISLAND_EXPERT:
            raise ValidationError("Comparación solo admite el mapa normal o uno experto.")
        if len(self.favorites) > MAX_FAVORITE_BERRIES:
            raise ValidationError(f"Hasta {MAX_FAVORITE_BERRIES} bayas favoritas.")
        picked = [b for b in self.favorites if b is not None]
        if len(picked) != len(set(picked)):
            raise ValidationError("Las bayas favoritas no pueden repetirse.")


@dataclass(frozen=True, slots=True)
class SharedComparison:
    id: str
    members: tuple[TeamMember, ...]
    map: SharedMap
    # The sharer's schedule: shown on the picture and compared with the recipient's.
    sleep: SleepSchedule
    language: ShareLanguage
    created_at: datetime
    last_opened_at: datetime

    def __post_init__(self) -> None:
        if not 1 <= len(self.members) <= MAX_SHARED_CARDS:
            raise ValidationError(f"Se comparten entre 1 y {MAX_SHARED_CARDS} Pokémon.")


def is_expired(share: SharedComparison, now: datetime) -> bool:
    """Gone once SHARE_TTL has passed since anyone last opened it."""
    return now - share.last_opened_at > SHARE_TTL
