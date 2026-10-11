"""The screenshot import use case: cap, reader and resolution."""

from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.application.screenshot_import_service import (
    DefaultScreenshotImportService,
    UnavailableScreenshotImportService,
)
from sleepmon.domain.errors import (
    DailyImportLimitError,
    PokemonNotRecognizedError,
    ScreenshotReaderUnavailableError,
    ValidationError,
)
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading
from tests.fakes import FakeScreenshotReader, InMemoryImportQuota

NOW = datetime(2026, 10, 11, 15, 0, tzinfo=UTC)
TODAY = date(2026, 10, 11)
USER = uuid4()
IMAGES = [Screenshot("image/jpeg", b"jpeg-bytes")]
PIKACHU = ScreenshotReading(species="Pikachu", level=10)


def service(
    reader: FakeScreenshotReader, quota: InMemoryImportQuota, limit: int = 50
) -> DefaultScreenshotImportService:
    return DefaultScreenshotImportService(
        reader, quota, StaticSpeciesCatalog(), clock=lambda: NOW, daily_limit=limit
    )


def test_a_read_counts_and_resolves() -> None:
    quota = InMemoryImportQuota()
    cfg = service(FakeScreenshotReader(PIKACHU), quota).read(USER, IMAGES)
    assert cfg.species == "Pikachu"
    assert quota.counts[(USER, TODAY)] == 1


def test_the_cap_refuses_without_calling_the_model() -> None:
    quota = InMemoryImportQuota()
    quota.counts[(USER, TODAY)] = 2
    reader = FakeScreenshotReader(PIKACHU)
    with pytest.raises(DailyImportLimitError) as exc:
        service(reader, quota, limit=2).read(USER, IMAGES)
    assert exc.value.resets_at == datetime(2026, 10, 12, tzinfo=UTC)
    assert reader.calls == 0


def test_a_zero_cap_refuses_every_read() -> None:
    quota = InMemoryImportQuota()
    reader = FakeScreenshotReader(PIKACHU)
    with pytest.raises(DailyImportLimitError) as exc:
        service(reader, quota, limit=0).read(USER, IMAGES)
    assert exc.value.resets_at == datetime(2026, 10, 12, tzinfo=UTC)
    assert reader.calls == 0
    assert quota.counts == {}


def test_an_unavailable_model_gives_the_read_back() -> None:
    quota = InMemoryImportQuota()
    reader = FakeScreenshotReader(error=ScreenshotReaderUnavailableError("down"))
    with pytest.raises(ScreenshotReaderUnavailableError):
        service(reader, quota).read(USER, IMAGES)
    assert quota.counts[(USER, TODAY)] == 0


def test_an_unrecognized_pokemon_still_counts() -> None:
    quota = InMemoryImportQuota()
    with pytest.raises(PokemonNotRecognizedError):
        service(FakeScreenshotReader(ScreenshotReading()), quota).read(USER, IMAGES)
    assert quota.counts[(USER, TODAY)] == 1


def test_no_images_is_rejected_before_counting() -> None:
    quota = InMemoryImportQuota()
    with pytest.raises(ValidationError):
        service(FakeScreenshotReader(PIKACHU), quota).read(USER, [])
    assert quota.counts == {}


def test_the_unavailable_service_always_raises() -> None:
    with pytest.raises(ScreenshotReaderUnavailableError):
        UnavailableScreenshotImportService().read(USER, IMAGES)
