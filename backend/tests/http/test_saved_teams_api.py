"""The saved-teams HTTP edge, with real services over in-memory repositories."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.auth_service import DefaultAuthService
from sleepmon.application.progress_service import DefaultPlayerProgressService
from sleepmon.application.saved_team_service import DefaultSavedTeamService
from sleepmon.application.services import DefaultProductionService, DefaultTeamService
from tests.fakes import (
    InMemoryPlayerProgressRepository,
    InMemoryRefreshTokenRepository,
    InMemorySavedTeamRepository,
    InMemoryTeamRepository,
    InMemoryUserRepository,
    StubIdentityProvider,
)

ACCESS = JwtAccessTokenService("test-secret", timedelta(minutes=15))
USER_ID = uuid4()
START = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


class StepClock:
    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        self.now += timedelta(minutes=1)
        return self.now


@pytest.fixture
def client() -> Iterator[TestClient]:
    members = InMemoryTeamRepository()
    saved = InMemorySavedTeamRepository()
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
        service=DefaultTeamService(
            members, StaticSpeciesCatalog(), InMemoryPlayerProgressRepository(), saved
        ),
        production_service=DefaultProductionService(StaticSpeciesCatalog(), StaticRecipeCatalog()),
        catalog=StaticSpeciesCatalog(),
        recipe_catalog=StaticRecipeCatalog(),
        access=ACCESS,
        auth_service=auth_service,
        progress_service=DefaultPlayerProgressService(
            InMemoryPlayerProgressRepository(), StaticRecipeCatalog()
        ),
        saved_team_service=DefaultSavedTeamService(
            saved, members, StaticRecipeCatalog(), StepClock()
        ),
    )
    with TestClient(app=app) as client:
        yield client


def headers(user_id: UUID = USER_ID) -> dict[str, str]:
    return {"Authorization": f"Bearer {ACCESS.issue(user_id)}"}


def add_pokemon(client: TestClient, user_id: UUID = USER_ID) -> str:
    response = client.post(
        "/team",
        json={
            "species": "Pikachu",
            "level": 30,
            "nature": "Adamant",
            "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        },
        headers=headers(user_id),
    )
    assert response.status_code == 201
    member_id: str = response.json()["id"]
    return member_id


def team_json(slots: list[dict[str, Any]], **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Cyan curry",
        "slots": slots,
        "island": "Cyan Beach",
        "favorite_berries": ["Oran", "Pecha", "Leppa"],
        "main_favorite": None,
        "weekly_bonus": "berry_strength",
        "dish_type": "Curry",
        "meals": ["Fancy Apple Curry", None, "Beanburger Curry"],
    }
    payload.update(overrides)
    return payload


def single(member_id: str) -> dict[str, Any]:
    return {"members": [member_id], "share": 1.0}


def test_every_endpoint_requires_auth(client: TestClient) -> None:
    some = uuid4()
    assert client.get("/saved-teams").status_code == 401
    assert client.post("/saved-teams", json=team_json([])).status_code == 401
    assert client.put(f"/saved-teams/{some}", json=team_json([])).status_code == 401
    assert client.patch(f"/saved-teams/{some}", json={"name": "x"}).status_code == 401
    assert client.delete(f"/saved-teams/{some}").status_code == 401


def test_a_new_account_has_no_teams(client: TestClient) -> None:
    response = client.get("/saved-teams", headers=headers())
    assert response.status_code == 200
    assert response.json() == []


def test_create_returns_the_saved_team(client: TestClient) -> None:
    a, b, c = add_pokemon(client), add_pokemon(client), add_pokemon(client)
    slots = [single(a), {"members": [b, c], "share": 0.6}, single(a)]
    response = client.post(
        "/saved-teams", json=team_json(slots, name="  Cyan curry "), headers=headers()
    )
    assert response.status_code == 201
    body = response.json()
    UUID(body.pop("id"))
    saved_at = datetime.fromisoformat(body.pop("saved_at"))
    assert saved_at == START + timedelta(minutes=1)
    assert body == team_json(slots, name="Cyan curry")
    assert len(client.get("/saved-teams", headers=headers()).json()) == 1


def test_optional_fields_may_be_omitted_or_null(client: TestClient) -> None:
    a = add_pokemon(client)
    response = client.post(
        "/saved-teams",
        json={
            "name": "Bare",
            "slots": [single(a)],
            "weekly_bonus": "berry_strength",
            "meals": [None, None, None],
            "dish_type": None,
        },
        headers=headers(),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["island"] is None
    assert body["favorite_berries"] == []
    assert body["main_favorite"] is None
    assert body["dish_type"] is None


def test_list_is_most_recently_saved_first(client: TestClient) -> None:
    a = add_pokemon(client)
    first = client.post(
        "/saved-teams", json=team_json([single(a)], name="First"), headers=headers()
    ).json()
    second = client.post(
        "/saved-teams", json=team_json([single(a)], name="Second"), headers=headers()
    ).json()
    names = [t["name"] for t in client.get("/saved-teams", headers=headers()).json()]
    assert names == ["Second", "First"]
    client.put(
        f"/saved-teams/{first['id']}", json=team_json([single(a)], name="First"), headers=headers()
    )
    ids = [t["id"] for t in client.get("/saved-teams", headers=headers()).json()]
    assert ids == [first["id"], second["id"]]


def test_teams_are_private_to_their_user(client: TestClient) -> None:
    a = add_pokemon(client)
    client.post("/saved-teams", json=team_json([single(a)]), headers=headers())
    assert client.get("/saved-teams", headers=headers(uuid4())).json() == []


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"name": "  "}, "El nombre del equipo no puede estar vacío."),
        ({"name": "x" * 41}, "El nombre del equipo admite hasta 40 caracteres."),
        ({"slots": []}, "Un equipo necesita al menos un Pokémon."),
        ({"island": "Atlantis"}, "Mapa"),
        ({"dish_type": "Soup"}, "Tipo de plato"),
        ({"weekly_bonus": "nope"}, "Bonus semanal"),
        ({"favorite_berries": ["Oran", "Pecha", "Leppa", "Cheri"]}, "Como máximo 3"),
        ({"meals": [None, None]}, "exactamente 3"),
        ({"meals": ["Mystery Stew", None, None]}, "No existe la receta"),
    ],
)
def test_invalid_payloads_are_400(
    client: TestClient, overrides: dict[str, Any], message: str
) -> None:
    a = add_pokemon(client)
    payload = {**team_json([single(a)]), **overrides}
    response = client.post("/saved-teams", json=payload, headers=headers())
    assert response.status_code == 400
    assert message in response.json()["detail"]


def test_six_slots_are_400(client: TestClient) -> None:
    a = add_pokemon(client)
    response = client.post("/saved-teams", json=team_json([single(a)] * 6), headers=headers())
    assert response.status_code == 400
    assert response.json()["detail"] == "Un equipo tiene como máximo 5 slots."


def test_a_split_share_out_of_range_is_400(client: TestClient) -> None:
    a, b = add_pokemon(client), add_pokemon(client)
    response = client.post(
        "/saved-teams",
        json=team_json([{"members": [a, b], "share": 1.0}]),
        headers=headers(),
    )
    assert response.status_code == 400


def test_a_member_outside_the_box_is_400(client: TestClient) -> None:
    theirs = add_pokemon(client, uuid4())
    response = client.post("/saved-teams", json=team_json([single(theirs)]), headers=headers())
    assert response.status_code == 400
    assert response.json()["detail"] == "Ese Pokémon no está en tu Caja."


def test_a_duplicate_name_is_400(client: TestClient) -> None:
    a = add_pokemon(client)
    client.post("/saved-teams", json=team_json([single(a)], name="Cyan Curry"), headers=headers())
    response = client.post(
        "/saved-teams", json=team_json([single(a)], name="cyan curry"), headers=headers()
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Ya tenés un equipo llamado «cyan curry»."


def test_put_replaces_and_bumps_saved_at(client: TestClient) -> None:
    a, b = add_pokemon(client), add_pokemon(client)
    created = client.post("/saved-teams", json=team_json([single(a)]), headers=headers()).json()
    slots = [{"members": [a, b], "share": 0.25}]
    response = client.put(
        f"/saved-teams/{created['id']}",
        json=team_json(slots, name="Taupe", island=None, favorite_berries=[]),
        headers=headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["name"] == "Taupe"
    assert body["slots"] == slots
    assert body["island"] is None
    assert body["saved_at"] > created["saved_at"]


def test_put_of_a_missing_team_is_404(client: TestClient) -> None:
    a = add_pokemon(client)
    response = client.put(f"/saved-teams/{uuid4()}", json=team_json([single(a)]), headers=headers())
    assert response.status_code == 404


def test_patch_renames_without_touching_saved_at(client: TestClient) -> None:
    a = add_pokemon(client)
    created = client.post("/saved-teams", json=team_json([single(a)]), headers=headers()).json()
    response = client.patch(
        f"/saved-teams/{created['id']}", json={"name": " Beach "}, headers=headers()
    )
    assert response.status_code == 200
    assert response.json() == {**created, "name": "Beach"}


def test_patch_follows_the_name_rules(client: TestClient) -> None:
    a = add_pokemon(client)
    client.post("/saved-teams", json=team_json([single(a)], name="Taupe"), headers=headers())
    created = client.post(
        "/saved-teams", json=team_json([single(a)], name="Cyan"), headers=headers()
    ).json()
    url = f"/saved-teams/{created['id']}"
    assert client.patch(url, json={"name": "taupe"}, headers=headers()).status_code == 400
    assert client.patch(url, json={"name": ""}, headers=headers()).status_code == 400
    assert client.patch(url, json={"name": "CYAN"}, headers=headers()).status_code == 200


def test_patch_of_a_missing_team_is_404(client: TestClient) -> None:
    response = client.patch(f"/saved-teams/{uuid4()}", json={"name": "x"}, headers=headers())
    assert response.status_code == 404


def test_delete_is_204_and_leaves_the_box(client: TestClient) -> None:
    a = add_pokemon(client)
    created = client.post("/saved-teams", json=team_json([single(a)]), headers=headers()).json()
    assert client.delete(f"/saved-teams/{created['id']}", headers=headers()).status_code == 204
    assert client.get("/saved-teams", headers=headers()).json() == []
    assert client.get(f"/team/{a}", headers=headers()).status_code == 200


def test_delete_of_a_missing_team_is_404(client: TestClient) -> None:
    assert client.delete(f"/saved-teams/{uuid4()}", headers=headers()).status_code == 404


def test_deleting_a_box_entry_detaches_it_from_saved_teams(client: TestClient) -> None:
    a, b = add_pokemon(client), add_pokemon(client)
    client.post(
        "/saved-teams",
        json=team_json([{"members": [b, a], "share": 0.6}], name="Split"),
        headers=headers(),
    )
    client.post("/saved-teams", json=team_json([single(a)], name="Only A"), headers=headers())

    assert client.delete(f"/team/{a}", headers=headers()).status_code == 204

    teams = client.get("/saved-teams", headers=headers()).json()
    assert [t["name"] for t in teams] == ["Split"]
    assert teams[0]["slots"] == [{"members": [b], "share": 1.0}]
