"""A still-valid access token whose user was deleted must read as 401, not 500.

After ``DELETE /auth/account`` the access token stays cryptographically valid until it
expires. A write with it hits the ``user_id`` foreign key; the HTTP adapter maps that
to 401 so the client refreshes, fails, and goes anonymous. Requires Postgres.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import PostgresUserRepository
from sleepmon.config import Settings
from sleepmon.domain.auth import User

pytestmark = pytest.mark.integration

JWT_SECRET = "test-jwt-secret-at-least-32-bytes-long"
ACCESS_TTL = timedelta(minutes=15)


@pytest.fixture
def client(test_dsn: str) -> Iterator[TestClient]:
    app = create_app(
        settings=Settings(
            database_url=test_dsn,
            google_client_id="test-client-id",
            jwt_secret=JWT_SECRET,
            access_ttl=ACCESS_TTL,
            refresh_ttl=timedelta(days=30),
            cookie_secure=False,
            cors_origins=("http://localhost:5173",),
            cookie_samesite="strict",
        )
    )
    with TestClient(app=app) as c:
        yield c


def test_write_with_token_of_deleted_user_is_401(test_dsn: str, client: TestClient) -> None:
    pool = create_pool(test_dsn)
    try:
        users = PostgresUserRepository(pool)
        user = User(
            id=uuid4(),
            google_sub=f"g-{uuid4()}",
            email="gone@example.com",
            display_name="Gone",
            avatar_url=None,
            created_at=datetime.now(UTC),
        )
        users.add(user)
        token = JwtAccessTokenService(JWT_SECRET, ACCESS_TTL).issue(user.id)
        auth = {"Authorization": f"Bearer {token}"}

        assert client.delete("/auth/account", headers=auth).status_code == 204

        res = client.post(
            "/team",
            json={
                "species": "Pikachu",
                "level": 30,
                "nature": "Adamant",
                "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
                "sub_skills": ["Helping Speed S"],
            },
            headers=auth,
        )
        assert res.status_code == 401
        assert res.json()["detail"] == "session no longer valid"
    finally:
        pool.close()
