"""Configuración leída del entorno."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

DEFAULT_DSN = "postgresql://sleepmon:sleepmon@localhost:5432/sleepmon"
# Screenshot import: Nova 2 Lite triages and reads English screens; any other
# language goes to Qwen3-VL. Nova 2 Lite is only served in us-east-1.
DEFAULT_SCREENSHOT_TRIAGE_MODEL = "us.amazon.nova-2-lite-v1:0"
DEFAULT_SCREENSHOT_MODEL = "us.amazon.nova-2-lite-v1:0"
DEFAULT_SCREENSHOT_MODEL_OTHER_LANGUAGES = "qwen.qwen3-vl-235b-a22b"
DEFAULT_BEDROCK_REGION = "us-east-1"
DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:3000"
DEFAULT_APP_URL = "http://localhost:5173"

_log = logging.getLogger(__name__)

SameSite = Literal["lax", "strict", "none"]


def _parse_samesite(raw: str) -> SameSite:
    value = raw.strip().lower()
    if value not in ("lax", "strict", "none"):
        raise ValueError(f"COOKIE_SAMESITE must be lax|strict|none, got {raw!r}")
    # mypy needs the narrowing: the membership check above guarantees the Literal.
    return value  # type: ignore[return-value]


def _parse_sample_rate(raw: str) -> float:
    try:
        value = float(raw)
    except ValueError as exc:
        raise ValueError(f"SENTRY_TRACES_SAMPLE_RATE must be a number, got {raw!r}") from exc
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"SENTRY_TRACES_SAMPLE_RATE must be within [0, 1], got {raw!r}")
    return value


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
    # Sentry (ADR-0010): an empty DSN disables it. The trace sample rate is
    # per-environment configuration, tuned to traffic.
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.0
    sentry_release: str | None = None
    # Connections each process keeps open. A Lambda instance serves one request at a
    # time, so the Lambda entry point lowers it to 1 (connections = instances).
    db_pool_size: int = 4
    # Screenshot import (PRD 0019).
    screenshot_triage_model: str = DEFAULT_SCREENSHOT_TRIAGE_MODEL
    screenshot_model: str = DEFAULT_SCREENSHOT_MODEL
    screenshot_model_other_languages: str = DEFAULT_SCREENSHOT_MODEL_OTHER_LANGUAGES
    bedrock_region: str = DEFAULT_BEDROCK_REGION
    screenshot_daily_limit: int = 50
    # Shared comparisons (PRD 0020). ``app_url`` is the frontend a share link sends
    # people on to. ``share_base_url`` is where share links point: the frontend's own
    # domain when it routes ``/s/*`` to this API, so links read as the app's; empty
    # uses the API's own address.
    app_url: str = DEFAULT_APP_URL
    share_base_url: str = ""
    # Human check for signed-out sharing (ADR 0012). Empty: signed-out sharing is off.
    turnstile_secret_key: str = ""

    @classmethod
    def from_env(cls) -> Settings:
        settings = cls._read_env()
        if not os.environ.get("APP_URL") and settings.cookie_secure:
            _log.warning(
                "APP_URL is not set: share links will redirect to %s. "
                "Set APP_URL to the frontend's origin.",
                DEFAULT_APP_URL,
            )
        return settings

    @classmethod
    def _read_env(cls) -> Settings:
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
            sentry_dsn=os.environ.get("SENTRY_DSN", ""),
            sentry_environment=os.environ.get("SENTRY_ENVIRONMENT", "development"),
            sentry_traces_sample_rate=_parse_sample_rate(
                os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0")
            ),
            sentry_release=os.environ.get("SENTRY_RELEASE") or None,
            screenshot_triage_model=os.environ.get(
                "SCREENSHOT_TRIAGE_MODEL", DEFAULT_SCREENSHOT_TRIAGE_MODEL
            ),
            screenshot_model=os.environ.get("SCREENSHOT_MODEL", DEFAULT_SCREENSHOT_MODEL),
            screenshot_model_other_languages=os.environ.get(
                "SCREENSHOT_MODEL_OTHER_LANGUAGES", DEFAULT_SCREENSHOT_MODEL_OTHER_LANGUAGES
            ),
            bedrock_region=os.environ.get("BEDROCK_REGION") or DEFAULT_BEDROCK_REGION,
            screenshot_daily_limit=int(os.environ.get("SCREENSHOT_DAILY_LIMIT", "50")),
            app_url=os.environ.get("APP_URL") or DEFAULT_APP_URL,
            share_base_url=os.environ.get("SHARE_BASE_URL", ""),
            turnstile_secret_key=os.environ.get("TURNSTILE_SECRET_KEY", ""),
        )
