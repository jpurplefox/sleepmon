"""Shared parsing helpers used across application services."""

from __future__ import annotations

from enum import StrEnum
from typing import TypeVar

from sleepmon.application.dto import SleepInput
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.sleep import DEFAULT_SLEEP, SleepSchedule

E = TypeVar("E", bound=StrEnum)


def parse_enum(enum_cls: type[E], value: str, field: str) -> E:
    try:
        return enum_cls(value)
    except ValueError as exc:
        valid = ", ".join(e.value for e in enum_cls)
        msg = f"Valor inválido para {field}: {value!r}. Opciones: {valid}."
        raise ValidationError(msg) from exc


def parse_sleep(data: SleepInput | None) -> SleepSchedule:
    """``None`` is the default night; the domain validates the ranges."""
    if data is None:
        return DEFAULT_SLEEP
    return SleepSchedule(night_minutes=data.night_minutes, nap_minutes=data.nap_minutes)
