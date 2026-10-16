"""Shared comparisons: the shape rules any share must keep (PRD 0020)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from sleepmon.domain.comparison_share import (
    MAX_SHARE_IMAGE_BYTES,
    SHARE_TTL,
    SharedComparison,
    SharedMap,
    ShareImage,
    ShareLanguage,
    is_expired,
)
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.sleep import SleepSchedule
from sleepmon.domain.value_objects import Berry, Ingredient, Island

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
OPENED = datetime(2026, 10, 1, tzinfo=UTC)


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
        sleep=SleepSchedule(),
        language=ShareLanguage.ES,
        created_at=OPENED,
        last_opened_at=OPENED,
    )


def test_ttl_is_ninety_days() -> None:
    assert timedelta(days=90) == SHARE_TTL


def test_a_share_lives_ninety_days_after_its_last_opening() -> None:
    share = _share((_pikachu(),))
    assert not is_expired(share, OPENED + timedelta(days=89))
    assert not is_expired(share, OPENED + SHARE_TTL)
    assert is_expired(share, OPENED + SHARE_TTL + timedelta(seconds=1))


def test_share_keeps_the_sharers_sleep() -> None:
    share = SharedComparison(
        id="abc123def456",
        members=(_pikachu(),),
        map=SharedMap(),
        sleep=SleepSchedule(night_minutes=420, nap_minutes=120),
        language=ShareLanguage.ES,
        created_at=OPENED,
        last_opened_at=OPENED,
    )
    assert (share.sleep.night_minutes, share.sleep.nap_minutes) == (420, 120)


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
    assert MAX_SHARE_IMAGE_BYTES == 500_000
    assert ShareImage("image/jpeg", JPEG + b"\x00" * (MAX_SHARE_IMAGE_BYTES - len(JPEG)))
    with pytest.raises(ValidationError):
        ShareImage("image/jpeg", JPEG + b"\x00" * (MAX_SHARE_IMAGE_BYTES - len(JPEG) + 1))


def test_share_holds_one_to_five_cards() -> None:
    assert len(_share((_pikachu(),) * 5).members) == 5
    with pytest.raises(ValidationError):
        _share(())
    with pytest.raises(ValidationError):
        _share((_pikachu(),) * 6)


def test_map_is_any_island() -> None:
    assert SharedMap(island=Island.CYAN_BEACH_EXPERT).island is Island.CYAN_BEACH_EXPERT
    assert SharedMap(island=Island.CYAN_BEACH).island is Island.CYAN_BEACH
    # Links made before Comparison named every map carry none.
    assert SharedMap().island is None


def test_map_keeps_open_favorite_slots() -> None:
    favorites = (None, Berry.ORAN, Berry.PECHA)
    assert SharedMap(favorites=favorites).favorites == favorites


def test_map_refuses_repeated_or_too_many_favorites() -> None:
    with pytest.raises(ValidationError):
        SharedMap(favorites=(Berry.ORAN, Berry.ORAN))
    with pytest.raises(ValidationError):
        SharedMap(favorites=(Berry.ORAN, Berry.PECHA, Berry.CHERI, Berry.RAWST))
