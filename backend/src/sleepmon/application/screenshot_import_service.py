"""Screenshot import use case (PRD 0019): daily cap around one model reading."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from uuid import UUID

from sleepmon.domain.errors import DailyImportLimitError, ScreenshotReaderUnavailableError
from sleepmon.domain.ports import ImportQuotaRepository, ScreenshotReader, SpeciesCatalog
from sleepmon.domain.screenshot_import import (
    DAILY_IMPORT_LIMIT,
    ImportedConfig,
    Screenshot,
    next_reset,
    resolve_reading,
    validate_screenshots,
)


class ScreenshotImportService(ABC):
    """Primary port: read a user's screenshots into a form-ready config."""

    @abstractmethod
    def read(self, user_id: UUID, images: Sequence[Screenshot]) -> ImportedConfig: ...


class DefaultScreenshotImportService(ScreenshotImportService):
    def __init__(
        self,
        reader: ScreenshotReader,
        quota: ImportQuotaRepository,
        catalog: SpeciesCatalog,
        clock: Callable[[], datetime],
        daily_limit: int = DAILY_IMPORT_LIMIT,
    ) -> None:
        self._reader = reader
        self._quota = quota
        self._catalog = catalog
        self._clock = clock
        self._limit = daily_limit

    def read(self, user_id: UUID, images: Sequence[Screenshot]) -> ImportedConfig:
        validate_screenshots(images)
        now = self._clock()
        if self._limit <= 0:
            # The quota upsert lets the first read through, so a zero cap is checked here.
            raise DailyImportLimitError(next_reset(now))
        day = now.astimezone(UTC).date()
        if not self._quota.reserve(user_id, day, self._limit):
            raise DailyImportLimitError(next_reset(now))
        try:
            reading = self._reader.read(images)
        except ScreenshotReaderUnavailableError:
            # Only reads that got an answer count toward the cap.
            self._quota.release(user_id, day)
            raise
        return resolve_reading(reading, self._catalog.get)


class UnavailableScreenshotImportService(ScreenshotImportService):
    """Stand-in when no reader is wired (tests, a stack without a database)."""

    def read(self, user_id: UUID, images: Sequence[Screenshot]) -> ImportedConfig:
        raise ScreenshotReaderUnavailableError("Screenshot import is not configured.")
