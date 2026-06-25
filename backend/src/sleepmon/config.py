"""Configuración leída del entorno."""

from __future__ import annotations

import os
from dataclasses import dataclass

DEFAULT_DSN = "postgresql://sleepmon:sleepmon@localhost:5432/sleepmon"


@dataclass(frozen=True, slots=True)
class Settings:
    """Settings de runtime."""

    database_url: str

    @classmethod
    def from_env(cls) -> Settings:
        return cls(database_url=os.environ.get("DATABASE_URL", DEFAULT_DSN))
