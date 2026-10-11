"""Postgres daily import cap. Requires the compose database; marked ``integration``."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, date, datetime
from uuid import UUID, uuid4

import pytest
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresImportQuotaRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import User

pytestmark = pytest.mark.integration

DAY = date(2026, 10, 11)


@pytest.fixture
def pool(test_dsn: str) -> Iterator[ConnectionPool]:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")  # cascades to screenshot_import_usage
    yield pool
    pool.close()


def _user(pool: ConnectionPool) -> UUID:
    user = User(
        id=uuid4(),
        google_sub=str(uuid4()),
        email="u@x.test",
        display_name="U",
        avatar_url=None,
        created_at=datetime.now(UTC),
    )
    PostgresUserRepository(pool).add(user)
    return user.id


def test_reserves_up_to_the_limit(pool: ConnectionPool) -> None:
    repo, user = PostgresImportQuotaRepository(pool), _user(pool)
    assert [repo.reserve(user, DAY, 2) for _ in range(3)] == [True, True, False]


def test_release_gives_one_back(pool: ConnectionPool) -> None:
    repo, user = PostgresImportQuotaRepository(pool), _user(pool)
    repo.reserve(user, DAY, 1)
    repo.release(user, DAY)
    assert repo.reserve(user, DAY, 1) is True


def test_days_and_users_are_counted_apart(pool: ConnectionPool) -> None:
    repo, a, b = PostgresImportQuotaRepository(pool), _user(pool), _user(pool)
    assert repo.reserve(a, DAY, 1)
    assert repo.reserve(b, DAY, 1)
    assert repo.reserve(a, date(2026, 10, 12), 1)


def test_release_without_a_row_is_harmless(pool: ConnectionPool) -> None:
    PostgresImportQuotaRepository(pool).release(_user(pool), DAY)
