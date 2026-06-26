import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.application.services import DefaultTeamService
from tests.fakes import InMemoryTeamRepository


@pytest.fixture
def client() -> TestClient:
    service = DefaultTeamService(InMemoryTeamRepository(), StaticSpeciesCatalog())
    app = create_app(service=service, catalog=StaticSpeciesCatalog())
    with TestClient(app=app) as client:
        yield client


def valid_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": "Adamant",
        "ingredients": ["Fancy Apple", "Warming Ginger"],
        "sub_skills": ["Helping Speed S"],
    }
    payload.update(overrides)
    return payload


def test_catalog_endpoint_lists_reference_data(client: TestClient) -> None:
    res = client.get("/catalog")
    assert res.status_code == 200
    body = res.json()
    assert len(body["natures"]) == 25
    assert len(body["sub_skills"]) == 17
    assert len(body["ingredients"]) == 19
    assert any(sp["name"] == "Pikachu" for sp in body["species"])

    # Los slots de ingrediente viajan EN ORDEN de juego (1º, 2º, 3º), como
    # prefijos crecientes — no alfabéticos. Caterpie: miel, luego tomate, luego beans.
    caterpie = next(sp for sp in body["species"] if sp["name"] == "Caterpie")
    assert caterpie["ingredient_slots"] == [
        ["Honey"],
        ["Honey", "Snoozy Tomato"],
        ["Honey", "Snoozy Tomato", "Greengrass Soybeans"],
    ]


def test_create_and_list_member(client: TestClient) -> None:
    res = client.post("/team", json=valid_payload())
    assert res.status_code == 201
    created = res.json()
    assert created["species"] == "Pikachu"

    listing = client.get("/team").json()
    assert len(listing) == 1
    assert listing[0]["id"] == created["id"]


def test_create_member_without_nature(client: TestClient) -> None:
    # naturaleza opcional: nature="" = "sin naturaleza".
    res = client.post("/team", json=valid_payload(nature=""))
    assert res.status_code == 201
    created = res.json()
    assert created["nature"] == ""

    listing = client.get("/team").json()
    assert listing[0]["nature"] == ""

    # No aparece en la distribución de naturalezas.
    dist = client.get("/team/distributions").json()
    assert dist["natures"] == {}


def test_create_member_nature_omitted_defaults_to_empty(client: TestClient) -> None:
    # El campo nature es opcional en el payload (default vacío).
    payload = valid_payload()
    del payload["nature"]
    res = client.post("/team", json=payload)
    assert res.status_code == 201
    assert res.json()["nature"] == ""


def test_distributions_endpoint(client: TestClient) -> None:
    client.post("/team", json=valid_payload())
    dist = client.get("/team/distributions").json()
    assert dist["natures"]["Adamant"] == 1
    assert dist["ingredients"]["Fancy Apple"] == 1


def test_unknown_species_returns_400(client: TestClient) -> None:
    res = client.post("/team", json=valid_payload(species="Mewtwo"))
    assert res.status_code == 400
    assert "Mewtwo" in res.json()["detail"]


def test_too_many_ingredients_returns_400(client: TestClient) -> None:
    # Más ingredientes que slots de la especie: 400 limpio, no 500.
    res = client.post(
        "/team",
        json=valid_payload(
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Apple", "Warming Ginger"],
        ),
    )
    assert res.status_code == 400


def test_production_endpoint_returns_estimate(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Pikachu",
            "level": 60,
            "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["helps_per_day"] > 0
    assert body["berry"] == "Grepa"  # baya de Pikachu
    # Skill independiente: baya + ingrediente = 100; el skill va aparte.
    assert body["berry_percentage"] + body["ingredient_percentage"] == pytest.approx(100)
    assert [s["ingredient"] for s in body["ingredients"]] == [
        "Fancy Apple",
        "Warming Ginger",
        "Fancy Egg",
    ]
    assert body["skill_triggers"] >= 0


def test_production_unknown_species_returns_400(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Mewtwo",
            "level": 60,
            "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        },
    )
    assert res.status_code == 400


def test_production_requires_three_ingredients(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={"species": "Pikachu", "level": 30, "ingredients": ["Fancy Apple", "Warming Ginger"]},
    )
    assert res.status_code == 400


def test_get_missing_member_returns_404(client: TestClient) -> None:
    res = client.get("/team/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_update_and_delete_flow(client: TestClient) -> None:
    member_id = client.post("/team", json=valid_payload()).json()["id"]

    upd = client.put(f"/team/{member_id}", json=valid_payload(level=60, nature="Modest"))
    assert upd.status_code == 200
    assert upd.json()["level"] == 60

    assert client.delete(f"/team/{member_id}").status_code == 204
    assert client.get("/team").json() == []
