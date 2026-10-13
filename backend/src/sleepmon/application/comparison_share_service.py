"""Shared comparisons use cases (PRD 0020).

Creating a share needs a signed-in user (the share belongs to them, and goes with
their account); reading one only needs its id, which is what the link carries.
"""

from __future__ import annotations

import secrets
from abc import ABC, abstractmethod
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sleepmon.application.dto import ComparisonShareInput
from sleepmon.application.parsing import parse_enum
from sleepmon.application.services import build_member
from sleepmon.domain.comparison_share import (
    SharedComparison,
    SharedMap,
    ShareImage,
    ShareLanguage,
)
from sleepmon.domain.errors import ComparisonShareNotFoundError
from sleepmon.domain.ports import ComparisonShareRepository, SpeciesCatalog
from sleepmon.domain.value_objects import Berry, Island, WeeklyBonus


def new_share_id() -> str:
    """12 URL-safe characters (72 random bits): short in a link, unguessable."""
    return secrets.token_urlsafe(9)


class ComparisonShareService(ABC):
    """Primary port: share a comparison, and read a shared one back."""

    @abstractmethod
    def create(self, user_id: UUID, data: ComparisonShareInput) -> SharedComparison: ...

    @abstractmethod
    def get(self, share_id: str) -> SharedComparison: ...

    @abstractmethod
    def image(self, share_id: str) -> ShareImage: ...


class DefaultComparisonShareService(ComparisonShareService):
    def __init__(
        self,
        repository: ComparisonShareRepository,
        catalog: SpeciesCatalog,
        clock: Callable[[], datetime],
        new_id: Callable[[], str] = new_share_id,
    ) -> None:
        self._repo = repository
        self._catalog = catalog
        self._clock = clock
        self._new_id = new_id

    def create(self, user_id: UUID, data: ComparisonShareInput) -> SharedComparison:
        image = ShareImage(media_type=data.image_media_type, data=data.image_data)
        share = SharedComparison(
            id=self._new_id(),
            members=tuple(build_member(self._catalog, m) for m in data.members),
            map=SharedMap(
                island=None if data.island is None else parse_enum(Island, data.island, "Mapa"),
                favorites=tuple(
                    parse_enum(Berry, b, "Baya") if b else None for b in data.favorites
                ),
                weekly_bonus=parse_enum(WeeklyBonus, data.weekly_bonus, "Bonus semanal"),
            ),
            language=parse_enum(ShareLanguage, data.language, "Idioma"),
            created_at=self._clock(),
        )
        self._repo.add(share, image, user_id)
        return share

    def get(self, share_id: str) -> SharedComparison:
        share = self._repo.get(share_id)
        if share is None:
            raise ComparisonShareNotFoundError(share_id)
        return share

    def image(self, share_id: str) -> ShareImage:
        image = self._repo.get_image(share_id)
        if image is None:
            raise ComparisonShareNotFoundError(share_id)
        return image


class UnavailableComparisonShareService(ComparisonShareService):
    """Stands in when the app is built without a database (test injection paths)."""

    def create(self, user_id: UUID, data: ComparisonShareInput) -> SharedComparison:
        raise RuntimeError("Sharing comparisons needs a database.")

    def get(self, share_id: str) -> SharedComparison:
        raise ComparisonShareNotFoundError(share_id)

    def image(self, share_id: str) -> ShareImage:
        raise ComparisonShareNotFoundError(share_id)
