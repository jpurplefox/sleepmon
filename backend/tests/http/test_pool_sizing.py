"""The real stack opens its DB pool with the configured size (no Postgres needed).

Lambda serves one request per instance, so its entry point sizes the pool to 1;
the pool is never opened here.
"""

from __future__ import annotations

import importlib
import sys
from dataclasses import replace
from datetime import timedelta

import pytest
from litestar import Litestar
from psycopg_pool import ConnectionPool

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.config import Settings


def _settings() -> Settings:
    return Settings(
        database_url="postgresql://unused:unused@localhost:5432/unused",
        google_client_id="cid",
        jwt_secret="s3cr3t",
        access_ttl=timedelta(minutes=15),
        refresh_ttl=timedelta(days=30),
        cookie_secure=True,
        cors_origins=("http://localhost:5173",),
        cookie_samesite="strict",
    )


def test_create_pool_holds_a_fixed_number_of_connections() -> None:
    pool = create_pool("postgresql://unused@localhost/unused", size=1, open_now=False)

    assert (pool.min_size, pool.max_size) == (1, 1)


def test_settings_default_to_a_pool_of_four() -> None:
    assert _settings().db_pool_size == 4


@pytest.mark.parametrize("size", [1, 4])
def test_real_stack_opens_one_pool_of_the_configured_size(
    monkeypatch: pytest.MonkeyPatch, size: int
) -> None:
    created: list[ConnectionPool] = []

    def unopened_pool(dsn: str, *, size: int = 4, open_now: bool = True) -> ConnectionPool:
        pool = create_pool(dsn, size=size, open_now=False)
        created.append(pool)
        return pool

    monkeypatch.setattr("sleepmon.adapters.inbound.http.app.create_pool", unopened_pool)
    monkeypatch.setattr("sleepmon.adapters.inbound.http.app.init_sentry", lambda _s: None)

    create_app(settings=replace(_settings(), db_pool_size=size))

    assert [p.max_size for p in created] == [size]


def test_lambda_entry_point_sizes_the_pool_to_one(monkeypatch: pytest.MonkeyPatch) -> None:
    pytest.importorskip("mangum")
    seen: list[Settings | None] = []

    def fake_create_app(*, settings: Settings | None = None) -> Litestar:
        seen.append(settings)
        return Litestar(route_handlers=[])

    monkeypatch.setattr("sleepmon.adapters.inbound.http.app.create_app", fake_create_app)
    monkeypatch.delitem(sys.modules, "sleepmon.adapters.inbound.http.lambda_handler", raising=False)

    importlib.import_module("sleepmon.adapters.inbound.http.lambda_handler")

    assert len(seen) == 1 and seen[0] is not None
    assert seen[0].db_pool_size == 1
