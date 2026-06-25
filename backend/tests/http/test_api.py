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


def test_create_and_list_member(client: TestClient) -> None:
    res = client.post("/team", json=valid_payload())
    assert res.status_code == 201
    created = res.json()
    assert created["species"] == "Pikachu"

    listing = client.get("/team").json()
    assert len(listing) == 1
    assert listing[0]["id"] == created["id"]


def test_distributions_endpoint(client: TestClient) -> None:
    client.post("/team", json=valid_payload())
    dist = client.get("/team/distributions").json()
    assert dist["natures"]["Adamant"] == 1
    assert dist["ingredients"]["Fancy Apple"] == 1


def test_unknown_species_returns_400(client: TestClient) -> None:
    res = client.post("/team", json=valid_payload(species="Mewtwo"))
    assert res.status_code == 400
    assert "Mewtwo" in res.json()["detail"]


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
