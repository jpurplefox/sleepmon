"""The player's sleep schedule: a night and an optional nap (PRD 0015)."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final

from sleepmon.domain.catalog_data import (
    DEFAULT_NIGHT_MINUTES,
    MAX_NAP_MINUTES,
    MAX_NIGHT_MINUTES,
    MAX_TOTAL_SLEEP_MINUTES,
    MIN_SLEEP_MINUTES,
    MINUTES_PER_DAY,
    SLEEP_STEP_MINUTES,
)
from sleepmon.domain.errors import ValidationError


class SleepKind(StrEnum):
    NIGHT = "night"
    NAP = "nap"


@dataclass(frozen=True, slots=True)
class SleepSession:
    kind: SleepKind
    minutes: int


def _validate(minutes: int, what: str, upper: int) -> None:
    if isinstance(minutes, bool) or not isinstance(minutes, int):
        raise ValidationError(f"{what} debe ser un entero de minutos; llegó {minutes!r}.")
    if minutes % SLEEP_STEP_MINUTES != 0:
        raise ValidationError(
            f"{what} va en pasos de {SLEEP_STEP_MINUTES} minutos; llegó {minutes}."
        )
    if not MIN_SLEEP_MINUTES <= minutes <= upper:
        raise ValidationError(
            f"{what} debe estar entre {MIN_SLEEP_MINUTES} y {upper} minutos; llegó {minutes}."
        )


@dataclass(frozen=True, slots=True)
class SleepSchedule:
    """Each sleep is its own session: the inventory starts empty in every one."""

    night_minutes: int = DEFAULT_NIGHT_MINUTES
    nap_minutes: int | None = None

    def __post_init__(self) -> None:
        _validate(self.night_minutes, "La noche", MAX_NIGHT_MINUTES)
        if self.nap_minutes is not None:
            _validate(self.nap_minutes, "La siesta", MAX_NAP_MINUTES)
        if self.asleep_minutes > MAX_TOTAL_SLEEP_MINUTES:
            raise ValidationError(
                f"Noche y siesta suman como mucho {MAX_TOTAL_SLEEP_MINUTES} minutos; "
                f"llegaron {self.asleep_minutes}."
            )

    @property
    def sessions(self) -> tuple[SleepSession, ...]:
        night = SleepSession(SleepKind.NIGHT, self.night_minutes)
        if self.nap_minutes is None:
            return (night,)
        return (night, SleepSession(SleepKind.NAP, self.nap_minutes))

    @property
    def asleep_minutes(self) -> int:
        return self.night_minutes + (self.nap_minutes or 0)

    @property
    def awake_minutes(self) -> int:
        return MINUTES_PER_DAY - self.asleep_minutes


DEFAULT_SLEEP: Final[SleepSchedule] = SleepSchedule()
