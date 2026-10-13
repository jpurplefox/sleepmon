"""Shared comparisons use cases (PRD 0020)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.application.comparison_share_service import (
    DefaultComparisonShareService,
    new_share_id,
)
from sleepmon.application.dto import ComparisonShareInput, SleepInput, TeamMemberInput
from sleepmon.domain.comparison_share import SHARE_TTL, ShareLanguage
from sleepmon.domain.errors import (
    AnonymousSharingUnavailableError,
    ComparisonShareNotFoundError,
    HumanVerificationError,
    HumanVerifierUnavailableError,
    ValidationError,
)
from sleepmon.domain.value_objects import Berry, Island, Nature, WeeklyBonus
from tests.fakes import FakeHumanVerifier, InMemoryComparisonShareRepository

USER = uuid4()
START = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
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


class Clock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def repo() -> InMemoryComparisonShareRepository:
    return InMemoryComparisonShareRepository()


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def verifier() -> FakeHumanVerifier:
    return FakeHumanVerifier(True)


@pytest.fixture
def service(
    repo: InMemoryComparisonShareRepository, clock: Clock, verifier: FakeHumanVerifier
) -> DefaultComparisonShareService:
    ids = iter(f"share{n:07d}" for n in range(1, 100))
    return DefaultComparisonShareService(
        repo, StaticSpeciesCatalog(), verifier, clock, new_id=lambda: next(ids)
    )


def test_signed_in_create_keeps_everything_and_skips_the_check(
    service: DefaultComparisonShareService,
    repo: InMemoryComparisonShareRepository,
    verifier: FakeHumanVerifier,
) -> None:
    share = service.create(
        USER,
        _input(
            island="Cyan Beach (Expert)",
            favorites=["", "Oran"],
            weekly_bonus="ingredient",
            language="en",
            sleep=SleepInput(night_minutes=420, nap_minutes=120),
        ),
    )
    assert share.members[0].nature is Nature.ADAMANT
    assert share.map.island is Island.CYAN_BEACH_EXPERT
    assert share.map.favorites == (None, Berry.ORAN)
    assert share.map.weekly_bonus is WeeklyBonus.INGREDIENT
    assert share.language is ShareLanguage.EN
    assert (share.sleep.night_minutes, share.sleep.nap_minutes) == (420, 120)
    assert share.created_at == share.last_opened_at == START
    assert repo.shares[share.id][0] == USER
    assert verifier.tokens == []


def test_sleep_defaults_to_the_default_night(service: DefaultComparisonShareService) -> None:
    assert service.create(USER, _input()).sleep.night_minutes == 510


def test_signed_out_create_needs_a_passing_token(
    service: DefaultComparisonShareService,
    repo: InMemoryComparisonShareRepository,
    verifier: FakeHumanVerifier,
) -> None:
    share = service.create(None, _input(verification_token="tok"))
    assert verifier.tokens == ["tok"]
    assert repo.shares[share.id][0] is None


def test_signed_out_without_a_token_is_refused(
    service: DefaultComparisonShareService, repo: InMemoryComparisonShareRepository
) -> None:
    with pytest.raises(HumanVerificationError):
        service.create(None, _input())
    assert repo.shares == {}


def test_a_failed_check_creates_nothing(
    service: DefaultComparisonShareService,
    repo: InMemoryComparisonShareRepository,
    verifier: FakeHumanVerifier,
) -> None:
    verifier.result = False
    with pytest.raises(HumanVerificationError):
        service.create(None, _input(verification_token="tok"))
    assert repo.shares == {}


def test_an_unreachable_verifier_is_reported(
    service: DefaultComparisonShareService, verifier: FakeHumanVerifier
) -> None:
    verifier.result = HumanVerifierUnavailableError()
    with pytest.raises(HumanVerifierUnavailableError):
        service.create(None, _input(verification_token="tok"))


def test_without_a_verifier_signed_out_sharing_is_off(
    repo: InMemoryComparisonShareRepository, clock: Clock
) -> None:
    service = DefaultComparisonShareService(repo, StaticSpeciesCatalog(), None, clock)
    with pytest.raises(AnonymousSharingUnavailableError):
        service.create(None, _input(verification_token="tok"))
    assert service.create(USER, _input()).id


def test_create_validates_each_card(
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


def test_open_renews_peek_and_image_do_not(
    service: DefaultComparisonShareService, repo: InMemoryComparisonShareRepository, clock: Clock
) -> None:
    share = service.create(USER, _input())
    clock.now = START + timedelta(days=30)
    service.peek(share.id)
    service.image(share.id)
    assert repo.shares[share.id][1].last_opened_at == START
    service.open(share.id)
    assert repo.shares[share.id][1].last_opened_at == START + timedelta(days=30)


def test_a_share_opened_89_days_ago_opens_and_renews(
    service: DefaultComparisonShareService, repo: InMemoryComparisonShareRepository, clock: Clock
) -> None:
    share = service.create(USER, _input())
    clock.now = START + timedelta(days=89)
    assert service.open(share.id).id == share.id
    assert repo.shares[share.id][1].last_opened_at == clock.now


def test_past_ninety_days_unopened_it_is_gone_everywhere(
    service: DefaultComparisonShareService, clock: Clock
) -> None:
    share = service.create(USER, _input())
    clock.now = START + SHARE_TTL + timedelta(seconds=1)
    for read in (service.open, service.peek, service.image):
        with pytest.raises(ComparisonShareNotFoundError):
            read(share.id)


def test_creating_a_share_purges_expired_ones(
    service: DefaultComparisonShareService, repo: InMemoryComparisonShareRepository, clock: Clock
) -> None:
    old = service.create(USER, _input())
    clock.now = START + SHARE_TTL + timedelta(days=1)
    new = service.create(USER, _input())
    assert set(repo.shares) == {new.id}
    assert old.id != new.id


def test_an_unknown_share_is_not_found(service: DefaultComparisonShareService) -> None:
    for read in (service.open, service.peek, service.image):
        with pytest.raises(ComparisonShareNotFoundError):
            read("missing")


def test_share_ids_are_short_url_safe_and_distinct() -> None:
    ids = {new_share_id() for _ in range(100)}
    assert len(ids) == 100
    assert all(len(i) == 12 and i.replace("-", "").replace("_", "").isalnum() for i in ids)
