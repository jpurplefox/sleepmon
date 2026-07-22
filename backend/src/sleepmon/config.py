"""Configuración leída del entorno."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

DEFAULT_DSN = "postgresql://sleepmon:sleepmon@localhost:5432/sleepmon"
DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:3000"

SameSite = Literal["lax", "strict", "none"]


def _parse_samesite(raw: str) -> SameSite:
    value = raw.strip().lower()
    if value not in ("lax", "strict", "none"):
        raise ValueError(f"COOKIE_SAMESITE must be lax|strict|none, got {raw!r}")
    # mypy needs the narrowing: the membership check above guarantees the Literal.
    return value  # type: ignore[return-value]


@dataclass(frozen=True, slots=True)
class Settings:
    """Settings de runtime."""

    database_url: str
    google_client_id: str
    jwt_secret: str
    access_ttl: timedelta
    refresh_ttl: timedelta
    cookie_secure: bool
    # Origen(es) permitidos para CORS y política SameSite de la cookie de refresh.
    # En deploy con frontend y API en dominios distintos, la cookie es cross-site:
    # hace falta ``COOKIE_SAMESITE=none`` (con ``COOKIE_SECURE=true``) y listar el
    # origen real del frontend en ``CORS_ORIGINS``.
    cors_origins: tuple[str, ...]
    cookie_samesite: SameSite

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            database_url=os.environ.get("DATABASE_URL", DEFAULT_DSN),
            google_client_id=os.environ.get("GOOGLE_CLIENT_ID", ""),
            jwt_secret=os.environ.get("JWT_SECRET", ""),
            access_ttl=timedelta(seconds=int(os.environ.get("ACCESS_TTL_SECONDS", "900"))),
            refresh_ttl=timedelta(seconds=int(os.environ.get("REFRESH_TTL_SECONDS", "2592000"))),
            cookie_secure=os.environ.get("COOKIE_SECURE", "true").lower() != "false",
            cors_origins=tuple(
                origin.strip()
                for origin in os.environ.get("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
                if origin.strip()
            ),
            cookie_samesite=_parse_samesite(os.environ.get("COOKIE_SAMESITE", "strict")),
        )
