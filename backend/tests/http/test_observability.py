"""Sentry adapter: scrubbing, opt-in init, user tagging and the Lambda flush."""

from __future__ import annotations

from dataclasses import replace
from typing import Any
from uuid import UUID

import pytest
import sentry_sdk

from sleepmon.adapters.inbound.http import observability
from sleepmon.adapters.inbound.http.observability import (
    flush_after,
    init_sentry,
    scrub_event,
    tag_request_user,
)
from sleepmon.config import Settings


def _replace(settings: Settings, **overrides: Any) -> Settings:
    return replace(settings, **overrides)


def test_scrub_event_drops_credentials_cookies_body_and_personal_fields() -> None:
    event: Any = {
        "request": {
            "headers": {"Authorization": "Bearer t", "Cookie": "r=1", "Accept": "json"},
            "cookies": {"refresh": "secret"},
            "data": {"name": "Mi equipo"},
        },
        "user": {"id": "u-1", "email": "a@b.c", "username": "Ana"},
    }

    out = scrub_event(event, {})

    assert out is not None
    assert out["request"] == {"headers": {"Accept": "json"}}
    assert out["user"] == {"id": "u-1"}


def test_scrub_event_keeps_events_without_request_or_user() -> None:
    event: Any = {"message": "boom"}
    assert scrub_event(event, {}) == {"message": "boom"}


def test_init_sentry_is_off_without_dsn() -> None:
    assert init_sentry(_replace(Settings.from_env(), sentry_dsn="")) is False


def test_settings_read_sentry_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SENTRY_DSN", "https://k@o.ingest.sentry.io/1")
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "production")
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "0.25")
    monkeypatch.setenv("SENTRY_RELEASE", "abc123")
    s = Settings.from_env()
    assert (s.sentry_dsn, s.sentry_environment, s.sentry_traces_sample_rate, s.sentry_release) == (
        "https://k@o.ingest.sentry.io/1",
        "production",
        0.25,
        "abc123",
    )


def test_settings_sentry_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for var in ("SENTRY_DSN", "SENTRY_ENVIRONMENT", "SENTRY_TRACES_SAMPLE_RATE", "SENTRY_RELEASE"):
        monkeypatch.delenv(var, raising=False)
    s = Settings.from_env()
    assert (s.sentry_dsn, s.sentry_environment, s.sentry_traces_sample_rate, s.sentry_release) == (
        "",
        "development",
        0.0,
        None,
    )


@pytest.mark.parametrize("raw", ["1.5", "-0.1", "abc"])
def test_settings_reject_invalid_sample_rate(monkeypatch: pytest.MonkeyPatch, raw: str) -> None:
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", raw)
    with pytest.raises(ValueError):
        Settings.from_env()


def test_tag_request_user_sets_only_the_id(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, str]] = []
    monkeypatch.setattr(sentry_sdk, "set_user", lambda u: calls.append(u))
    tag_request_user(UUID("00000000-0000-0000-0000-000000000001"))
    assert calls == [{"id": "00000000-0000-0000-0000-000000000001"}]


def test_flush_after_flushes_and_passes_the_response(monkeypatch: pytest.MonkeyPatch) -> None:
    flushed: list[float] = []
    monkeypatch.setattr(observability.sentry_sdk, "flush", lambda timeout: flushed.append(timeout))
    handler = flush_after(lambda event, context: {"statusCode": 200})
    assert handler({}, None) == {"statusCode": 200}
    assert flushed == [2.0]


def test_flush_after_flushes_when_the_handler_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    flushed: list[float] = []
    monkeypatch.setattr(observability.sentry_sdk, "flush", lambda timeout: flushed.append(timeout))

    def boom(event: dict[str, Any], context: Any) -> dict[str, Any]:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        flush_after(boom)({}, None)
    assert flushed == [2.0]
