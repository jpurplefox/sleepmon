"""HTTP edge of the screenshot import."""

from __future__ import annotations

import base64
from collections.abc import Callable, Iterator
from contextlib import ExitStack
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
from sleepmon.application.screenshot_import_service import DefaultScreenshotImportService
from sleepmon.application.services import DefaultProductionService, DefaultTeamService
from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.screenshot_import import ScreenshotReading
from tests.fakes import (
    FakeScreenshotReader,
    InMemoryImportQuota,
    InMemoryPlayerProgressRepository,
    InMemoryRefreshTokenRepository,
    InMemorySavedTeamRepository,
    InMemoryTeamRepository,
    InMemoryUserRepository,
    StubIdentityProvider,
)

ACCESS = JwtAccessTokenService("test-secret", timedelta(minutes=15))
AUTH = {"Authorization": f"Bearer {ACCESS.issue(uuid4())}"}
JPEG = {"media_type": "image/jpeg", "data": base64.b64encode(b"\xff\xd8jpeg").decode()}
NOW = datetime(2026, 10, 11, 12, 0, tzinfo=UTC)

MakeClient = Callable[..., TestClient]


@pytest.fixture
def make_client() -> Iterator[MakeClient]:
    with ExitStack() as stack:

        def make(reader: FakeScreenshotReader, limit: int = 50) -> TestClient:
            catalog = StaticSpeciesCatalog()
            app = create_app(
                service=DefaultTeamService(
                    InMemoryTeamRepository(),
                    catalog,
                    InMemoryPlayerProgressRepository(),
                    InMemorySavedTeamRepository(),
                ),
                production_service=DefaultProductionService(catalog, StaticRecipeCatalog()),
                catalog=catalog,
                recipe_catalog=StaticRecipeCatalog(),
                access=ACCESS,
                auth_service=DefaultAuthService(
                    identity=StubIdentityProvider(),
                    users=InMemoryUserRepository(),
                    tokens=InMemoryRefreshTokenRepository(),
                    access=ACCESS,
                    refresh=SecretsRefreshTokenCodec(),
                    clock=lambda: NOW,
                    refresh_ttl=timedelta(days=30),
                ),
                screenshot_import_service=DefaultScreenshotImportService(
                    reader, InMemoryImportQuota(), catalog, clock=lambda: NOW, daily_limit=limit
                ),
            )
            return stack.enter_context(TestClient(app=app))

        yield make


def post(client: TestClient, images: list[dict[str, str]], auth: bool = True):  # type: ignore[no-untyped-def]
    return client.post("/screenshot-import", json={"images": images}, headers=AUTH if auth else {})


def test_is_reserved(make_client: MakeClient) -> None:
    assert post(make_client(FakeScreenshotReader()), [JPEG], auth=False).status_code == 401


def test_returns_the_resolved_config(make_client: MakeClient) -> None:
    reading = ScreenshotReading(species="Pikachu", level=25, nature="Jolly", skill_level=2)
    res = post(make_client(FakeScreenshotReader(reading)), [JPEG])
    assert res.status_code == 200
    body = res.json()
    assert body["species"] == "Pikachu"
    assert body["level"] == 25
    assert body["nature"] == "Jolly"
    assert body["ingredients"] == [None, None, None]
    assert body["unread"] == ["ingredients", "sub_skills", "ribbon"]


def test_bad_base64_is_a_400(make_client: MakeClient) -> None:
    res = post(make_client(FakeScreenshotReader()), [{"media_type": "image/png", "data": "@@@"}])
    assert res.status_code == 400


def test_no_images_is_a_400(make_client: MakeClient) -> None:
    assert post(make_client(FakeScreenshotReader()), []).status_code == 400


def test_not_recognized_is_a_422(make_client: MakeClient) -> None:
    assert post(make_client(FakeScreenshotReader(ScreenshotReading())), [JPEG]).status_code == 422


def test_the_cap_is_a_429_with_the_reset_time(make_client: MakeClient) -> None:
    client = make_client(FakeScreenshotReader(ScreenshotReading(species="Pikachu")), limit=1)
    assert post(client, [JPEG]).status_code == 200
    res = post(client, [JPEG])
    assert res.status_code == 429
    assert res.json()["resets_at"] == "2026-10-12T00:00:00+00:00"


def test_an_unavailable_model_is_a_503(make_client: MakeClient) -> None:
    reader = FakeScreenshotReader(error=ScreenshotReaderUnavailableError("down"))
    assert post(make_client(reader), [JPEG]).status_code == 503
