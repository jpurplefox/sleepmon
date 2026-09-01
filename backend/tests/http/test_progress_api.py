"""El borde HTTP del progreso, con un servicio real sobre repos en memoria."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.auth_service import DefaultAuthService
from sleepmon.application.progress_service import DefaultPlayerProgressService
from sleepmon.application.services import (
    DefaultProductionService,
    DefaultTeamService,
)
from tests.fakes import (
    InMemoryPlayerProgressRepository,
    InMemoryRefreshTokenRepository,
    InMemoryTeamRepository,
    InMemoryUserRepository,
    StubIdentityProvider,
)

ACCESS = JwtAccessTokenService("test-secret", timedelta(minutes=15))
USER_ID = uuid4()


@pytest.fixture
def client() -> Iterator[TestClient]:
    auth_service = DefaultAuthService(
        identity=StubIdentityProvider(),
        users=InMemoryUserRepository(),
        tokens=InMemoryRefreshTokenRepository(),
        access=ACCESS,
        refresh=SecretsRefreshTokenCodec(),
        clock=lambda: datetime.now(UTC),
        refresh_ttl=timedelta(days=30),
    )
    app = create_app(
        service=DefaultTeamService(InMemoryTeamRepository(), StaticSpeciesCatalog()),
        production_service=DefaultProductionService(
            StaticSpeciesCatalog(), StaticRecipeCatalog()
        ),
        catalog=StaticSpeciesCatalog(),
        recipe_catalog=StaticRecipeCatalog(),
        access=ACCESS,
        auth_service=auth_service,
        progress_service=DefaultPlayerProgressService(
            InMemoryPlayerProgressRepository(), StaticRecipeCatalog()
        ),
    )
    with TestClient(app=app) as client:
        yield client


@pytest.fixture
def auth_header() -> dict[str, str]:
    return {"Authorization": f"Bearer {ACCESS.issue(USER_ID)}"}


def test_progress_is_reserved(client: TestClient) -> None:
    assert client.get("/progress").status_code == 401
    assert client.patch("/progress", json={"pot_size": 33}).status_code == 401


def test_a_new_account_reads_the_defaults(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    body = client.get("/progress", headers=auth_header).json()
    assert body == {
        "pot_size": 21,
        "recipe_levels": {},
        "favorite_recipes": {},
        "area_bonuses": {},
    }


def test_patch_returns_the_whole_document(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    body = client.patch(
        "/progress", json={"pot_size": 33}, headers=auth_header
    ).json()
    assert body["pot_size"] == 33
    assert body["recipe_levels"] == {}


def test_patching_one_field_leaves_the_rest(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    client.patch("/progress", json={"pot_size": 33}, headers=auth_header)
    body = client.patch(
        "/progress",
        json={"recipe_levels": {"Beanburger Curry": 55}},
        headers=auth_header,
    ).json()
    assert body["pot_size"] == 33
    assert body["recipe_levels"] == {"Beanburger Curry": 55}


def test_a_favorite_can_be_cleared_with_null(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    client.patch(
        "/progress",
        json={"favorite_recipes": {"Curry": "Beanburger Curry"}},
        headers=auth_header,
    )
    body = client.patch(
        "/progress", json={"favorite_recipes": {"Curry": None}}, headers=auth_header
    ).json()
    assert body["favorite_recipes"] == {}


def test_an_off_ladder_pot_is_a_400(client: TestClient, auth_header: dict[str, str]) -> None:
    response = client.patch("/progress", json={"pot_size": 40}, headers=auth_header)
    assert response.status_code == 400
    assert "escalones" in response.json()["detail"]


def test_an_unknown_area_is_a_400(client: TestClient, auth_header: dict[str, str]) -> None:
    response = client.patch(
        "/progress", json={"area_bonuses": {"Atlantis": 40}}, headers=auth_header
    )
    assert response.status_code == 400


def test_an_unknown_field_is_rejected(
    client: TestClient, auth_header: dict[str, str]
) -> None:
    response = client.patch("/progress", json={"pot": 33}, headers=auth_header)
    assert response.status_code == 400


def test_progress_is_isolated_per_user(client: TestClient, auth_header: dict[str, str]) -> None:
    client.patch("/progress", json={"pot_size": 33}, headers=auth_header)
    other = {"Authorization": f"Bearer {ACCESS.issue(uuid4())}"}
    assert client.get("/progress", headers=other).json()["pot_size"] == 21
