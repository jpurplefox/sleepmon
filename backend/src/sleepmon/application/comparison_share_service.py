"""Shared comparisons use cases (PRD 0020).

Anyone can share: signed in, the share belongs to the account and goes with it;
signed out, it belongs to no one and needs a human check first (ADR 0012). Reading
needs only the id. A share expires 90 days after it was last opened, and only the app
opening it counts: link previews re-fetching the page or image don't keep it alive.
"""

from __future__ import annotations

import secrets
from abc import ABC, abstractmethod
from collections.abc import Callable
from datetime import datetime
from uuid import UUID

from sleepmon.application.dto import ComparisonShareInput
from sleepmon.application.parsing import parse_enum, parse_sleep
from sleepmon.application.services import build_member
from sleepmon.domain.comparison_share import (
    SHARE_TTL,
    SharedComparison,
    SharedMap,
    ShareImage,
    ShareLanguage,
    is_expired,
)
from sleepmon.domain.errors import (
    AnonymousSharingUnavailableError,
    ComparisonShareNotFoundError,
    HumanVerificationError,
)
from sleepmon.domain.ports import ComparisonShareRepository, HumanVerifier, SpeciesCatalog
from sleepmon.domain.value_objects import Berry, Island, WeeklyBonus


def new_share_id() -> str:
    """12 URL-safe characters (72 random bits): short in a link, unguessable."""
    return secrets.token_urlsafe(9)


class ComparisonShareService(ABC):
    """Primary port: share a comparison, and read a shared one back."""

    @abstractmethod
    def create(self, owner: UUID | None, data: ComparisonShareInput) -> SharedComparison: ...

    @abstractmethod
    def open(self, share_id: str) -> SharedComparison:
        """The app opening the share: its 90 days start over."""

    @abstractmethod
    def peek(self, share_id: str) -> SharedComparison:
        """The link's page: read without renewing."""

    @abstractmethod
    def image(self, share_id: str) -> ShareImage: ...


class DefaultComparisonShareService(ComparisonShareService):
    def __init__(
        self,
        repository: ComparisonShareRepository,
        catalog: SpeciesCatalog,
        verifier: HumanVerifier | None,
        clock: Callable[[], datetime],
        new_id: Callable[[], str] = new_share_id,
    ) -> None:
        self._repo = repository
        self._catalog = catalog
        # None: no human check configured, so signed-out sharing is off.
        self._verifier = verifier
        self._clock = clock
        self._new_id = new_id

    def create(self, owner: UUID | None, data: ComparisonShareInput) -> SharedComparison:
        if owner is None:
            self._check_human(data.verification_token)
        image = ShareImage(media_type=data.image_media_type, data=data.image_data)
        now = self._clock()
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
            sleep=parse_sleep(data.sleep),
            language=parse_enum(ShareLanguage, data.language, "Idioma"),
            created_at=now,
            last_opened_at=now,
        )
        # Housekeeping without a scheduler: each new share clears the expired ones.
        self._repo.delete_expired(now - SHARE_TTL)
        self._repo.add(share, image, owner)
        return share

    def open(self, share_id: str) -> SharedComparison:
        share = self._live(share_id)
        self._repo.touch(share.id, self._clock())
        return share

    def peek(self, share_id: str) -> SharedComparison:
        return self._live(share_id)

    def image(self, share_id: str) -> ShareImage:
        self._live(share_id)
        image = self._repo.get_image(share_id)
        if image is None:
            raise ComparisonShareNotFoundError(share_id)
        return image

    def _live(self, share_id: str) -> SharedComparison:
        share = self._repo.get(share_id)
        if share is None or is_expired(share, self._clock()):
            raise ComparisonShareNotFoundError(share_id)
        return share

    def _check_human(self, token: str | None) -> None:
        if self._verifier is None:
            raise AnonymousSharingUnavailableError()
        if not token or not self._verifier.verify(token):
            raise HumanVerificationError()


class UnavailableComparisonShareService(ComparisonShareService):
    """Stands in when the app is built without a database (test injection paths)."""

    def create(self, owner: UUID | None, data: ComparisonShareInput) -> SharedComparison:
        raise RuntimeError("Sharing comparisons needs a database.")

    def open(self, share_id: str) -> SharedComparison:
        raise ComparisonShareNotFoundError(share_id)

    def peek(self, share_id: str) -> SharedComparison:
        raise ComparisonShareNotFoundError(share_id)

    def image(self, share_id: str) -> ShareImage:
        raise ComparisonShareNotFoundError(share_id)
