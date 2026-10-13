"""The shared-comparison HTTP edge (PRD 0020): create, read back, and the link's page."""

from __future__ import annotations

import base64
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.auth_service import DefaultAuthService
from sleepmon.application.comparison_share_service import DefaultComparisonShareService
from sleepmon.application.progress_service import DefaultPlayerProgressService
from sleepmon.application.saved_team_service import DefaultSavedTeamService
from sleepmon.application.services import DefaultProductionService, DefaultTeamService
from sleepmon.config import Settings
from tests.fakes import (
    FakeHumanVerifier,
    InMemoryComparisonShareRepository,
    InMemoryPlayerProgressRepository,
    InMemoryRefreshTokenRepository,
    InMemorySavedTeamRepository,
    InMemoryTeamRepository,
    InMemoryUserRepository,
    StubIdentityProvider,
)

ACCESS = JwtAccessTokenService("test-secret", timedelta(minutes=15))
USER_ID = uuid4()
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


def _client(
    settings: Settings | None = None,
    verifier: FakeHumanVerifier | None = None,
    clock: Clock | None = None,
    no_verifier: bool = False,
) -> TestClient[Any]:
    members = InMemoryTeamRepository()
    saved = InMemorySavedTeamRepository()
    auth_clock = lambda: datetime.now(UTC)  # noqa: E731
    app = create_app(
        service=DefaultTeamService(
            members, StaticSpeciesCatalog(), InMemoryPlayerProgressRepository(), saved
        ),
        production_service=DefaultProductionService(StaticSpeciesCatalog(), StaticRecipeCatalog()),
        catalog=StaticSpeciesCatalog(),
        recipe_catalog=StaticRecipeCatalog(),
        settings=settings,
        access=ACCESS,
        auth_service=DefaultAuthService(
            identity=StubIdentityProvider(),
            users=InMemoryUserRepository(),
            tokens=InMemoryRefreshTokenRepository(),
            access=ACCESS,
            refresh=SecretsRefreshTokenCodec(),
            clock=auth_clock,
            refresh_ttl=timedelta(days=30),
        ),
        progress_service=DefaultPlayerProgressService(
            InMemoryPlayerProgressRepository(), StaticRecipeCatalog()
        ),
        saved_team_service=DefaultSavedTeamService(
            saved, members, StaticRecipeCatalog(), auth_clock
        ),
        comparison_share_service=DefaultComparisonShareService(
            InMemoryComparisonShareRepository(),
            StaticSpeciesCatalog(),
            None if no_verifier else verifier or FakeHumanVerifier(True),
            clock or Clock(),
        ),
    )
    return TestClient(app=app)


@pytest.fixture
def client() -> Iterator[TestClient[Any]]:
    with _client() as client:
        yield client


def headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {ACCESS.issue(USER_ID)}"}


def payload(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "members": [
            {
                "species": "Pikachu",
                "level": 30,
                "nature": "Adamant",
                "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            },
            {
                "species": "Pikachu",
                "level": 50,
                "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            },
        ],
        "island": "Cyan Beach (Expert)",
        "favorites": ["Grepa", "", "Oran"],
        "weekly_bonus": "skill_trigger",
        "language": "es",
        "image": {"media_type": "image/jpeg", "data": base64.b64encode(JPEG).decode()},
    }
    body.update(overrides)
    return body


def test_signed_out_with_a_token_creates_the_link(client: TestClient[Any]) -> None:
    response = client.post("/comparison-shares", json=payload(verification_token="tok"))
    assert response.status_code == 201


def test_signed_out_without_a_token_is_403(client: TestClient[Any]) -> None:
    response = client.post("/comparison-shares", json=payload())
    assert response.status_code == 403
    assert response.json()["detail"] == "verification failed"


def test_an_invalid_session_is_401_not_anonymous(client: TestClient[Any]) -> None:
    response = client.post(
        "/comparison-shares", json=payload(), headers={"Authorization": "Bearer nope"}
    )
    assert response.status_code == 401


def test_an_unreachable_verifier_is_503() -> None:
    from sleepmon.domain.errors import HumanVerifierUnavailableError

    with _client(verifier=FakeHumanVerifier(HumanVerifierUnavailableError())) as client:
        response = client.post("/comparison-shares", json=payload(verification_token="tok"))
    assert response.status_code == 503


def test_anonymous_create_without_a_verifier_is_401() -> None:
    with _client(no_verifier=True) as client:
        response = client.post("/comparison-shares", json=payload(verification_token="tok"))
    assert response.status_code == 401
    assert response.json() == {"detail": "sign in to share a link"}


def test_the_sleep_round_trips(client: TestClient[Any]) -> None:
    body = payload(sleep={"night_minutes": 420, "nap_minutes": 120})
    created = client.post("/comparison-shares", json=body, headers=headers()).json()
    assert created["sleep"] == {"night_minutes": 420, "nap_minutes": 120}
    assert client.get(f"/comparison-shares/{created['id']}").json()["sleep"] == created["sleep"]


def test_expired_shares_are_404_everywhere_and_previews_dont_renew() -> None:
    clock = Clock()
    with _client(clock=clock) as client:
        share_id = client.post("/comparison-shares", json=payload(), headers=headers()).json()["id"]
        clock.now += timedelta(days=60)
        assert client.get(f"/s/{share_id}").status_code == 200
        assert client.get(f"/s/{share_id}/image").status_code == 200
        clock.now += timedelta(days=31)  # 91 days since the only real opening (creation)
        for path in (f"/comparison-shares/{share_id}", f"/s/{share_id}", f"/s/{share_id}/image"):
            assert client.get(path).status_code == 404


def test_opening_in_the_app_renews() -> None:
    clock = Clock()
    with _client(clock=clock) as client:
        share_id = client.post("/comparison-shares", json=payload(), headers=headers()).json()["id"]
        clock.now += timedelta(days=60)
        assert client.get(f"/comparison-shares/{share_id}").status_code == 200
        clock.now += timedelta(days=60)
        assert client.get(f"/comparison-shares/{share_id}").status_code == 200


def test_create_returns_the_link_and_the_copied_comparison(client: TestClient[Any]) -> None:
    response = client.post("/comparison-shares", json=payload(), headers=headers())

    assert response.status_code == 201
    body = response.json()
    assert body["url"] == f"http://testserver.local/s/{body['id']}"
    assert [m["level"] for m in body["members"]] == [30, 50]
    assert body["members"][0]["nature"] == "Adamant"
    assert body["members"][1]["nature"] == ""
    assert body["island"] == "Cyan Beach (Expert)"
    assert body["favorites"] == ["Grepa", "", "Oran"]
    assert body["weekly_bonus"] == "skill_trigger"


def test_anyone_with_the_id_reads_the_share_back(client: TestClient[Any]) -> None:
    created = client.post("/comparison-shares", json=payload(), headers=headers()).json()

    response = client.get(f"/comparison-shares/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_an_unknown_share_is_404(client: TestClient[Any]) -> None:
    assert client.get("/comparison-shares/nope").status_code == 404
    assert client.get("/s/nope").status_code == 404
    assert client.get("/s/nope/image").status_code == 404


def test_create_rejects_an_invalid_card_or_image(client: TestClient[Any]) -> None:
    bad_card = payload(members=[{"species": "Missingno", "level": 1, "ingredients": []}])
    assert client.post("/comparison-shares", json=bad_card, headers=headers()).status_code == 400
    not_base64 = payload(image={"media_type": "image/jpeg", "data": "%%%"})
    assert client.post("/comparison-shares", json=not_base64, headers=headers()).status_code == 400
    not_an_image = payload(
        image={"media_type": "image/jpeg", "data": base64.b64encode(b"hello").decode()}
    )
    assert (
        client.post("/comparison-shares", json=not_an_image, headers=headers()).status_code == 400
    )


def test_the_link_page_carries_the_preview_and_sends_on_to_the_app(
    client: TestClient[Any],
) -> None:
    share_id = client.post("/comparison-shares", json=payload(), headers=headers()).json()["id"]

    response = client.get(f"/s/{share_id}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    html = response.text
    assert '<meta property="og:title" content="Comparación: Pikachu vs Pikachu">' in html
    assert f'content="http://testserver.local/s/{share_id}/image"' in html
    assert 'name="twitter:card" content="summary_large_image"' in html
    assert f"http://localhost:5173/compare?share={share_id}" in html


def test_the_link_page_follows_the_sharers_language(client: TestClient[Any]) -> None:
    body = payload(language="en")
    share_id = client.post("/comparison-shares", json=body, headers=headers()).json()["id"]

    html = client.get(f"/s/{share_id}").text

    assert '<html lang="en">' in html
    assert "Comparison: Pikachu vs Pikachu" in html


def test_the_image_is_served_as_uploaded(client: TestClient[Any]) -> None:
    share_id = client.post("/comparison-shares", json=payload(), headers=headers()).json()["id"]

    response = client.get(f"/s/{share_id}/image")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == JPEG
    assert response.headers["cache-control"] == "public, max-age=3600"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_an_unknown_link_page_is_html_that_sends_on_to_the_app(client: TestClient[Any]) -> None:
    response = client.get("/s/nope")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert "http://localhost:5173/compare?share=nope" in response.text
    assert "og:image" not in response.text


def test_an_unknown_link_id_cannot_break_out_of_the_page(client: TestClient[Any]) -> None:
    response = client.get("/s/%22%3E%3Cscript%3Ealert(1)%3C")

    assert response.status_code == 404
    assert "<script>alert" not in response.text
    assert '"><script' not in response.text
    assert "compare?share=%22%3E%3Cscript%3Ealert%281%29%3C" in response.text


def test_configured_urls_shape_the_link_and_the_redirect() -> None:
    settings = Settings(
        database_url="",
        google_client_id="x",
        jwt_secret="x",
        access_ttl=timedelta(minutes=15),
        refresh_ttl=timedelta(days=30),
        cookie_secure=True,
        cors_origins=("https://sleepmon.app",),
        cookie_samesite="strict",
        app_url="https://sleepmon.app",
        share_base_url="https://sleepmon.app/",
    )
    with _client(settings) as client:
        created = client.post("/comparison-shares", json=payload(), headers=headers()).json()
        html = client.get(f"/s/{created['id']}").text

    assert created["url"] == f"https://sleepmon.app/s/{created['id']}"
    assert f'content="https://sleepmon.app/s/{created["id"]}/image"' in html
    assert f"https://sleepmon.app/compare?share={created['id']}" in html
