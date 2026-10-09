"""Error and performance monitoring (Sentry) for the HTTP adapter (ADR-0010).

The only module that imports ``sentry_sdk``: the domain and the application never
learn that monitoring exists. Every function is harmless while Sentry is not
initialised, so tests and local runs without ``SENTRY_DSN`` send nothing.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import UUID

import sentry_sdk
from sentry_sdk.integrations.litestar import LitestarIntegration
from sentry_sdk.types import Event, Hint

from sleepmon.config import Settings

SCRUBBED_HEADERS = frozenset({"authorization", "cookie", "set-cookie"})

LambdaHandler = Callable[[dict[str, Any], Any], dict[str, Any]]


def scrub_event(event: Event, hint: Hint) -> Event | None:
    """Drop credentials, cookies, request bodies and any user field but the id."""
    request = event.get("request")
    if request is not None:
        request.pop("cookies", None)
        request.pop("data", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                k: v for k, v in headers.items() if k.lower() not in SCRUBBED_HEADERS
            }
    user = event.get("user")
    if user is not None:
        event["user"] = {"id": user["id"]} if "id" in user else {}
    return event


def init_sentry(settings: Settings) -> bool:
    """Start Sentry when a DSN is configured; return whether it is active."""
    if not settings.sentry_dsn:
        return False
    if sentry_sdk.get_client().is_active():
        return True
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        release=settings.sentry_release,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
        integrations=[LitestarIntegration()],
        before_send=scrub_event,
        before_send_transaction=scrub_event,
    )
    return True


def tag_request_user(user_id: UUID) -> None:
    """Attach the internal user id (never the email) to the current request's events."""
    sentry_sdk.set_user({"id": str(user_id)})


def flush_after(handler: LambdaHandler, timeout: float = 2.0) -> LambdaHandler:
    """Flush queued events after each invocation, before Lambda freezes the runtime."""

    def wrapped(event: dict[str, Any], context: Any) -> dict[str, Any]:
        try:
            return handler(event, context)
        finally:
            sentry_sdk.flush(timeout=timeout)

    return wrapped
