from datetime import timedelta

import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.auth_service import AuthResult, AuthService, UserDTO
from sleepmon.application.services import DefaultTeamService
from sleepmon.domain.auth import InvalidRefreshError
from tests.fakes import InMemoryTeamRepository

REFRESH_COOKIE = "refresh_token"


class FakeAuth(AuthService):
    def __init__(self) -> None:
        self.logged_out: list[str] = []

    def login_with_google(self, credential: str) -> AuthResult:
        return AuthResult("access-1", "refresh-1", UserDTO("u1", "a@b.com", "Ada", None))

    def refresh(self, refresh_token: str) -> AuthResult:
        if refresh_token != "refresh-1":
            raise InvalidRefreshError("nope")
        return AuthResult("access-2", "refresh-2", UserDTO("u1", "a@b.com", "Ada", None))

    def logout(self, refresh_token: str) -> None:
        self.logged_out.append(refresh_token)


@pytest.fixture
def client_and_auth() -> tuple[TestClient, FakeAuth]:
    auth = FakeAuth()
    service = DefaultTeamService(
        InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
    )
    app = create_app(
        service=service,
        catalog=StaticSpeciesCatalog(),
        recipe_catalog=StaticRecipeCatalog(),
        access=JwtAccessTokenService("test-secret", timedelta(minutes=15)),
        auth_service=auth,
    )
    with TestClient(app=app) as client:
        yield client, auth


def test_google_login_returns_access_and_sets_refresh_cookie(
    client_and_auth: tuple[TestClient, FakeAuth],
) -> None:
    client, _ = client_and_auth
    res = client.post("/auth/google", json={"credential": "id-token"})
    assert res.status_code == 200
    assert res.json()["access_token"] == "access-1"
    assert res.json()["user"]["display_name"] == "Ada"
    assert REFRESH_COOKIE in res.cookies
    assert "refresh-1" not in res.text  # never in the body


def test_refresh_rotates_from_cookie(client_and_auth: tuple[TestClient, FakeAuth]) -> None:
    client, _ = client_and_auth
    client.cookies.set(REFRESH_COOKIE, "refresh-1")
    res = client.post("/auth/refresh")
    assert res.status_code == 200
    assert res.json()["access_token"] == "access-2"


def test_refresh_without_cookie_is_401(client_and_auth: tuple[TestClient, FakeAuth]) -> None:
    client, _ = client_and_auth
    assert client.post("/auth/refresh").status_code == 401


def test_logout_clears_cookie(client_and_auth: tuple[TestClient, FakeAuth]) -> None:
    client, auth = client_and_auth
    client.cookies.set(REFRESH_COOKIE, "refresh-1")
    res = client.post("/auth/logout")
    assert res.status_code == 204
    assert auth.logged_out == ["refresh-1"]
