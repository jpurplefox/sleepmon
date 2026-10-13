"""Shared comparisons: the shape rules any share must keep (PRD 0020)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from sleepmon.domain.comparison_share import (
    MAX_SHARE_IMAGE_BYTES,
    SharedComparison,
    SharedMap,
    ShareImage,
    ShareLanguage,
)
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Berry, Ingredient, Island

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


def _pikachu() -> TeamMember:
    return TeamMember(
        species="Pikachu",
        level=30,
        nature=None,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
    )


def _share(members: tuple[TeamMember, ...]) -> SharedComparison:
    return SharedComparison(
        id="abc123def456",
        members=members,
        map=SharedMap(),
        language=ShareLanguage.ES,
        created_at=datetime(2026, 10, 1, tzinfo=UTC),
    )


@pytest.mark.parametrize(("media_type", "data"), [("image/jpeg", JPEG), ("image/png", PNG)])
def test_image_accepts_jpeg_and_png(media_type: str, data: bytes) -> None:
    assert ShareImage(media_type, data).data == data


def test_image_rejects_other_formats() -> None:
    with pytest.raises(ValidationError):
        ShareImage("image/webp", b"RIFF0000WEBP")


def test_image_is_checked_by_its_bytes_not_the_claimed_type() -> None:
    with pytest.raises(ValidationError):
        ShareImage("image/jpeg", PNG)


def test_image_has_a_size_cap() -> None:
    with pytest.raises(ValidationError):
        ShareImage("image/jpeg", JPEG + b"\x00" * MAX_SHARE_IMAGE_BYTES)


def test_share_holds_one_to_five_cards() -> None:
    assert len(_share((_pikachu(),) * 5).members) == 5
    with pytest.raises(ValidationError):
        _share(())
    with pytest.raises(ValidationError):
        _share((_pikachu(),) * 6)


def test_map_is_normal_or_expert() -> None:
    assert SharedMap(island=Island.CYAN_BEACH_EXPERT).island is Island.CYAN_BEACH_EXPERT
    with pytest.raises(ValidationError):
        SharedMap(island=Island.CYAN_BEACH)


def test_map_keeps_open_favorite_slots() -> None:
    favorites = (None, Berry.ORAN, Berry.PECHA)
    assert SharedMap(favorites=favorites).favorites == favorites


def test_map_refuses_repeated_or_too_many_favorites() -> None:
    with pytest.raises(ValidationError):
        SharedMap(favorites=(Berry.ORAN, Berry.ORAN))
    with pytest.raises(ValidationError):
        SharedMap(favorites=(Berry.ORAN, Berry.PECHA, Berry.CHERI, Berry.RAWST))
