"""Configuración leída del entorno."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta

DEFAULT_DSN = "postgresql://sleepmon:sleepmon@localhost:5432/sleepmon"


@dataclass(frozen=True, slots=True)
class Settings:
    """Settings de runtime."""

    database_url: str
    google_client_id: str
    jwt_secret: str
    access_ttl: timedelta
    refresh_ttl: timedelta
    cookie_secure: bool

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=os.environ.get("DATABASE_URL", DEFAULT_DSN),
            google_client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
            jwt_secret=os.environ.get("JWT_SECRET", ""),
            access_ttl=timedelta(seconds=int(os.environ.get("ACCESS_TTL_SECONDS", "900"))),
            refresh_ttl=timedelta(seconds=int(os.environ.get("REFRESH_TTL_SECONDS", "2592000"))),
            cookie_secure=os.environ.get("COOKIE_SECURE", "true").lower() != "false",
        )
