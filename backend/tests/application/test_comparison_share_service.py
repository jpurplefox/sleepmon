"""Shared comparisons use cases (PRD 0020)."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.application.comparison_share_service import (
    DefaultComparisonShareService,
    new_share_id,
)
from sleepmon.application.dto import ComparisonShareInput, TeamMemberInput
from sleepmon.domain.comparison_share import ShareLanguage
from sleepmon.domain.errors import ComparisonShareNotFoundError, ValidationError
from sleepmon.domain.value_objects import Berry, Island, Nature, WeeklyBonus
from tests.fakes import InMemoryComparisonShareRepository

USER = uuid4()
NOW = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
PIKACHU = TeamMemberInput(
    species="Pikachu",
    level=30,
    nature="Adamant",
    ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
)


def _input(**overrides: object) -> ComparisonShareInput:
    fields: dict[str, object] = {
        "members": [PIKACHU],
        "image_media_type": "image/jpeg",
        "image_data": JPEG,
    }
    fields.update(overrides)
    return ComparisonShareInput(**fields)  # type: ignore[arg-type]


@pytest.fixture
def repo() -> InMemoryComparisonShareRepository:
    return InMemoryComparisonShareRepository()


@pytest.fixture
def service(repo: InMemoryComparisonShareRepository) -> DefaultComparisonShareService:
    return DefaultComparisonShareService(
        repo, StaticSpeciesCatalog(), clock=lambda: NOW, new_id=lambda: "share0000001"
    )


def test_create_keeps_the_cards_map_and_image_under_the_sharer(
    service: DefaultComparisonShareService, repo: InMemoryComparisonShareRepository
) -> None:
    share = service.create(
        USER,
        _input(
            island="Cyan Beach (Expert)",
            favorites=["", "Oran"],
            weekly_bonus="ingredient",
            language="en",
        ),
    )

    assert share.id == "share0000001"
    assert [m.species for m in share.members] == ["Pikachu"]
    assert share.members[0].nature is Nature.ADAMANT
    assert share.map.island is Island.CYAN_BEACH_EXPERT
    assert share.map.favorites == (None, Berry.ORAN)
    assert share.map.weekly_bonus is WeeklyBonus.INGREDIENT
    assert share.language is ShareLanguage.EN
    assert share.created_at == NOW
    owner, stored, image = repo.shares["share0000001"]
    assert (owner, stored) == (USER, share)
    assert image.data == JPEG


def test_create_validates_each_card_against_the_catalog(
    service: DefaultComparisonShareService, repo: InMemoryComparisonShareRepository
) -> None:
    bad = TeamMemberInput(species="Pikachu", level=30, nature="", ingredients=["Bean Sausage"])
    with pytest.raises(ValidationError):
        service.create(USER, _input(members=[bad]))
    assert repo.shares == {}


def test_create_refuses_an_unknown_language_or_map(service: DefaultComparisonShareService) -> None:
    with pytest.raises(ValidationError):
        service.create(USER, _input(language="fr"))
    with pytest.raises(ValidationError):
        service.create(USER, _input(island="Atlantis"))


def test_get_and_image_read_a_share_back(service: DefaultComparisonShareService) -> None:
    share = service.create(USER, _input())
    assert service.get(share.id) == share
    assert service.image(share.id).data == JPEG


def test_an_unknown_share_is_not_found(service: DefaultComparisonShareService) -> None:
    with pytest.raises(ComparisonShareNotFoundError):
        service.get("missing")
    with pytest.raises(ComparisonShareNotFoundError):
        service.image("missing")


def test_share_ids_are_short_url_safe_and_distinct() -> None:
    ids = {new_share_id() for _ in range(100)}
    assert len(ids) == 100
    assert all(len(i) == 12 and i.replace("-", "").replace("_", "").isalnum() for i in ids)
