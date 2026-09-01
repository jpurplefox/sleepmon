"""Shared parsing helpers used across application services."""

from __future__ import annotations

from enum import StrEnum
from typing import TypeVar

from sleepmon.domain.errors import ValidationError

E = TypeVar("E", bound=StrEnum)


def parse_enum(enum_cls: type[E], value: str, field: str) -> E:
    try:
        return enum_cls(value)
    except ValueError as exc:
        valid = ", ".join(e.value for e in enum_cls)
        msg = f"Valor inválido para {field}: {value!r}. Opciones: {valid}."
        raise ValidationError(msg) from exc
