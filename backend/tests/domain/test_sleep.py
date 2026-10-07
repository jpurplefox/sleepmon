"""Sleep schedule: validation and the sessions it yields (PRD 0015)."""

from __future__ import annotations

import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.sleep import DEFAULT_SLEEP, SleepKind, SleepSchedule, SleepSession


def test_default_is_the_100_point_night_without_nap() -> None:
    assert SleepSchedule(night_minutes=510, nap_minutes=None) == DEFAULT_SLEEP
    assert DEFAULT_SLEEP.sessions == (SleepSession(SleepKind.NIGHT, 510),)
    assert DEFAULT_SLEEP.asleep_minutes == 510
    assert DEFAULT_SLEEP.awake_minutes == 930


def test_nap_is_a_second_session_after_the_night() -> None:
    s = SleepSchedule(night_minutes=390, nap_minutes=120)
    assert s.sessions == (
        SleepSession(SleepKind.NIGHT, 390),
        SleepSession(SleepKind.NAP, 120),
    )
    assert s.asleep_minutes == 510
    assert s.awake_minutes == 930


@pytest.mark.parametrize(("night", "nap"), [(90, None), (720, None), (720, 120), (600, 240)])
def test_limits_are_inclusive(night: int, nap: int | None) -> None:
    SleepSchedule(night_minutes=night, nap_minutes=nap)


@pytest.mark.parametrize(
    ("night", "nap"),
    [
        (75, None),  # under 1:30
        (735, None),  # over 12:00
        (500, None),  # off the 15-minute grid
        (510, 75),  # nap under 1:30
        (510, 255),  # nap over 4:00
        (510, 100),  # nap off the grid
        (660, 195),  # total 14:15 > 14:00
    ],
)
def test_out_of_range_schedules_are_rejected(night: int, nap: int | None) -> None:
    with pytest.raises(ValidationError):
        SleepSchedule(night_minutes=night, nap_minutes=nap)


def test_bool_is_not_a_duration() -> None:
    with pytest.raises(ValidationError):
        SleepSchedule(night_minutes=True)  # type: ignore[arg-type]
