"""Tests de los adapters Postgres de autenticación. Requieren una base real (docker
compose). Corren contra la base de test dedicada (ver ``conftest.py``), nunca contra
la de desarrollo. Se saltan solos si no hay Postgres accesible. Marcados ``integration``.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresRefreshTokenRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import RefreshToken, User

pytestmark = pytest.mark.integration


@pytest.fixture
def pool(test_dsn: str) -> Iterator[ConnectionPool]:
    p = create_pool(test_dsn)
    with p.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")
    try:
        yield p
    finally:
        with p.connection() as conn:
            conn.execute("TRUNCATE app_user CASCADE")
        p.close()


def _user() -> User:
    return User(
        id=uuid4(),
        google_sub="g-1",
        email="a@b.com",
        display_name="Ada",
        avatar_url=None,
        created_at=datetime.now(UTC),
    )


def test_user_add_and_lookup_by_sub(pool: ConnectionPool) -> None:
    repo = PostgresUserRepository(pool)
    u = _user()
    repo.add(u)

    fetched_by_sub = repo.get_by_google_sub("g-1")
    assert fetched_by_sub is not None
    assert fetched_by_sub.id == u.id

    fetched_by_id = repo.get(u.id)
    assert fetched_by_id is not None
    assert fetched_by_id.email == "a@b.com"

    assert repo.get_by_google_sub("missing") is None


def test_refresh_add_find_consume_delete_family(pool: ConnectionPool) -> None:
    users = PostgresUserRepository(pool)
    tokens = PostgresRefreshTokenRepository(pool)
    u = _user()
    users.add(u)
    fam = uuid4()
    now = datetime.now(UTC)
    t = RefreshToken(
        id=uuid4(),
        family_id=fam,
        user_id=u.id,
        token_hash="h1",
        consumed=False,
        expires_at=now + timedelta(days=1),
        created_at=now,
    )
    tokens.add(t)

    found = tokens.find_by_hash("h1")
    assert found is not None
    assert found.id == t.id

    tokens.consume(t.id)
    consumed = tokens.find_by_hash("h1")
    assert consumed is not None
    assert consumed.consumed is True

    tokens.delete_family(fam)
    assert tokens.find_by_hash("h1") is None


def test_delete_expired_removes_only_past(pool: ConnectionPool) -> None:
    users = PostgresUserRepository(pool)
    tokens = PostgresRefreshTokenRepository(pool)
    u = _user()
    users.add(u)
    now = datetime.now(UTC)
    old = RefreshToken(
        id=uuid4(),
        family_id=uuid4(),
        user_id=u.id,
        token_hash="old",
        consumed=True,
        expires_at=now - timedelta(days=1),
        created_at=now,
    )
    live = RefreshToken(
        id=uuid4(),
        family_id=uuid4(),
        user_id=u.id,
        token_hash="live",
        consumed=False,
        expires_at=now + timedelta(days=1),
        created_at=now,
    )
    tokens.add(old)
    tokens.add(live)

    assert tokens.delete_expired(now) == 1
    assert tokens.find_by_hash("old") is None
    assert tokens.find_by_hash("live") is not None
