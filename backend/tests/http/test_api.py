import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.services import DefaultTeamService
from tests.fakes import InMemoryTeamRepository


def _slots_json(*ids: str) -> list[dict]:
    return [{"entries": [{"member_id": i}]} for i in ids]


@pytest.fixture
def client() -> TestClient:
    service = DefaultTeamService(
        InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
    )
    app = create_app(
        service=service, catalog=StaticSpeciesCatalog(), recipe_catalog=StaticRecipeCatalog()
    )
    with TestClient(app=app) as client:
        yield client


def valid_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": "Adamant",
        "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
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

    # La tabla de bonus por nivel de receta: 70 entradas, índice 0 = nivel 1 = 1.0.
    assert len(body["recipe_level_bonus"]) == 70
    assert body["recipe_level_bonus"][0] == 1.0

    # Fuerza base por ingrediente: 19 entradas, una por ingrediente.
    ing_str = body["ingredient_strengths"]
    assert len(ing_str) == 19
    assert ing_str["Slowpoke Tail"] == 342
    assert ing_str["Fancy Apple"] == 90


def test_catalog_islands_expose_ratings(client: TestClient) -> None:
    body = client.get("/catalog").json()
    islands = {i["name"]: i for i in body["islands"]}
    green = islands["Greengrass Isle"]
    assert len(green["ratings"]) == 35
    assert green["ratings"][0] == {"tier": "basic", "level": 1, "required_strength": 0}
    assert green["ratings"][-1] == {
        "tier": "master",
        "level": 20,
        "required_strength": 3245795,
    }


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


def test_create_member_with_ribbon_roundtrips(client: TestClient) -> None:
    res = client.post("/team", json=valid_payload(ribbon="500h"))
    assert res.status_code == 201
    assert res.json()["ribbon"] == "500h"
    assert client.get("/team").json()[0]["ribbon"] == "500h"


def test_ribbon_defaults_to_empty_when_omitted(client: TestClient) -> None:
    res = client.post("/team", json=valid_payload())
    assert res.status_code == 201
    assert res.json()["ribbon"] == ""


def test_production_ribbon_raises_inventory(client: TestClient) -> None:
    body = {
        "species": "Pikachu",
        "level": 60,
        "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
    }
    base = client.post("/production", json=body).json()
    ribboned = client.post("/production", json={**body, "ribbon": "500h"}).json()
    # Acumulativo: a las 500h ya se ganaron 200h(+1) y 500h(+2) -> +3 de inventario;
    # en una línea de 3 etapas (Pikachu) además acelera la ayuda.
    assert ribboned["inventory"] == base["inventory"] + 3
    assert ribboned["seconds_per_help"] < base["seconds_per_help"]


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
    # Fuerza directa de las bayas: cantidad × fuerza por baya del nivel (Grepa L60 = 107).
    assert body["berry_strength"] == pytest.approx(body["berry_amount"] * 107)


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


def test_member_skill_level_roundtrips_and_defaults(client: TestClient) -> None:
    # Omitido -> default 1.
    created = client.post("/team", json=valid_payload()).json()
    assert created["skill_level"] == 1
    # Explícito -> se preserva.
    with_skill = client.post("/team", json=valid_payload(skill_level=5)).json()
    assert with_skill["skill_level"] == 5
    assert client.get(f"/team/{with_skill['id']}").json()["skill_level"] == 5


def test_production_exposes_skill_ingredients_for_ingredient_draw(client: TestClient) -> None:
    body = {
        "species": "Crustle",
        "level": 60,
        "ingredients": ["Glossy Avocado", "Soft Potato", "Pure Oil"],
        "skill_level": 7,
    }
    res = client.post("/production", json=body)
    assert res.status_code == 200
    payload = res.json()
    pool = {s["ingredient"] for s in payload["skill_ingredients"]}
    assert pool == {"Glossy Avocado", "Soft Potato", "Pure Oil"}
    each = payload["skill_triggers"] * 18 / 3
    assert all(s["amount"] == pytest.approx(each) for s in payload["skill_ingredients"])


def test_production_skill_ingredients_empty_for_other_skills(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Pikachu",
            "level": 60,
            "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        },
    )
    assert res.status_code == 200
    assert res.json()["skill_ingredients"] == []


def test_production_invalid_skill_level_returns_400(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Crustle",
            "level": 60,
            "ingredients": ["Glossy Avocado", "Soft Potato", "Pure Oil"],
            "skill_level": 9,
        },
    )
    assert res.status_code == 400


def test_production_exposes_skill_energy_for_e4e(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Sylveon",
            "level": 60,
            "ingredients": ["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            "skill_level": 6,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_energy"] == pytest.approx(body["skill_triggers"] * 18)
    assert body["skill_ingredients"] == []


def test_production_skill_energy_null_for_non_e4e(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Crustle",
            "level": 60,
            "ingredients": ["Glossy Avocado", "Soft Potato", "Pure Oil"],
        },
    )
    assert res.status_code == 200
    assert res.json()["skill_energy"] is None


def test_production_exposes_skill_ingredient_total_for_magnet(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Bulbasaur",
            "level": 60,
            "ingredients": ["Honey", "Snoozy Tomato", "Soft Potato"],
            "skill_level": 7,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_ingredient_total"] == pytest.approx(body["skill_triggers"] * 24)
    assert body["skill_ingredients"] == []
    assert body["skill_energy"] is None


def test_production_skill_ingredient_total_null_for_non_magnet(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Sylveon",
            "level": 60,
            "ingredients": ["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
        },
    )
    assert res.status_code == 200
    assert res.json()["skill_ingredient_total"] is None


def test_production_exposes_skill_cooking_ingredients_for_cooking_power_up(
    client: TestClient,
) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Flareon",
            "level": 60,
            "ingredients": ["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            "skill_level": 7,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_cooking_ingredients"] == pytest.approx(body["skill_triggers"] * 31)
    assert body["skill_ingredients"] == []
    assert body["skill_energy"] is None
    assert body["skill_ingredient_total"] is None


def test_production_skill_cooking_null_for_non_cooking_skill(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Crustle",
            "level": 60,
            "ingredients": ["Glossy Avocado", "Soft Potato", "Pure Oil"],
        },
    )
    assert res.status_code == 200
    assert res.json()["skill_cooking_ingredients"] is None


def test_production_exposes_skill_strength_for_charge_strength(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Pikachu",
            "level": 60,
            "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            "skill_level": 7,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_strength"] == pytest.approx(body["skill_triggers"] * 3212)


def test_production_skill_strength_null_for_non_charge(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Crustle",
            "level": 60,
            "ingredients": ["Glossy Avocado", "Soft Potato", "Pure Oil"],
        },
    )
    assert res.status_code == 200
    assert res.json()["skill_strength"] is None


def test_production_exposes_skill_self_energy_for_charge_energy(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Rattata",
            "level": 60,
            "ingredients": ["Fancy Apple", "Greengrass Soybeans", "Bean Sausage"],
            "skill_level": 6,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_self_energy"] == pytest.approx(body["skill_triggers"] * 43)
    assert body["skill_energy"] is None


def test_production_exposes_tasty_chance_for_tasty_chance_skill(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Sneasel",
            "level": 60,
            "ingredients": ["Bean Sausage", "Bean Sausage", "Bean Sausage"],
            "skill_level": 6,
        },
    )
    assert res.status_code == 200
    body = res.json()
    # Se acumula con los disparos (× 10% del nivel 6), sin tope.
    assert body["skill_tasty_chance"] == pytest.approx(body["skill_triggers"] * 10)


def test_production_tasty_chance_null_for_other_skills(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Crustle",
            "level": 60,
            "ingredients": ["Glossy Avocado", "Soft Potato", "Pure Oil"],
        },
    )
    assert res.status_code == 200
    assert res.json()["skill_tasty_chance"] is None


def test_production_exposes_extra_helpful_multiplier(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Jolteon",
            "level": 60,
            "ingredients": ["Moomoo Milk", "Moomoo Milk", "Moomoo Milk"],
            "skill_level": 7,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_extra_helpful"] == pytest.approx(body["skill_triggers"] * 12)


def test_production_exposes_random_energy_for_energizing_cheer(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Vulpix",
            "level": 60,
            "ingredients": ["Greengrass Soybeans", "Greengrass Soybeans", "Greengrass Soybeans"],
            "skill_level": 6,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_random_energy"] == pytest.approx(body["skill_triggers"] * 50)
    assert body["skill_energy"] is None
    assert body["skill_self_energy"] is None


def test_production_plusle_magnet_plus_total(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Plusle",
            "level": 60,
            "ingredients": ["Rousing Coffee", "Rousing Coffee", "Rousing Coffee"],
            "skill_level": 7,
        },
    )
    assert res.status_code == 200
    body = res.json()
    # Base al azar (18 a nivel 7) en el total; el bonus específico (café) va a
    # skill_ingredients (sección Ingredientes).
    assert body["skill_ingredient_total"] == pytest.approx(body["skill_triggers"] * 18)
    assert body["skill_ingredients"] == [
        {"ingredient": "Rousing Coffee", "amount": pytest.approx(body["skill_triggers"] * 12)}
    ]


def test_production_minun_pot_and_random_energy(client: TestClient) -> None:
    res = client.post(
        "/production",
        json={
            "species": "Minun",
            "level": 60,
            "ingredients": ["Honey", "Honey", "Honey"],
            "skill_level": 7,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["skill_cooking_ingredients"] == pytest.approx(body["skill_triggers"] * 24)
    assert body["skill_random_energy"] == pytest.approx(body["skill_triggers"] * 35)


def test_recipes_endpoint_lists_recipes(client: TestClient) -> None:
    res = client.get("/recipes")
    assert res.status_code == 200
    body = res.json()
    assert body, "debe devolver al menos una receta"
    types = {r["type"] for r in body}
    assert types == {"Curry", "Salad", "Dessert"}
    first = body[0]
    assert {"name", "type", "ingredients", "base_strength"} <= first.keys()
    assert all({"ingredient", "count"} <= ing.keys() for ing in first["ingredients"])


def test_team_production_endpoint(client: TestClient) -> None:
    created = client.post("/team", json=valid_payload()).json()
    res = client.post(
        "/teams/production",
        json={"slots": _slots_json(created["id"]), "meals": [None, None, None]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["member_count"] == 1
    assert "grand_total_strength" in body
    assert isinstance(body["ingredients"], list)
    assert isinstance(body["members"], list)
    # Each member now carries a full production object.
    member = body["members"][0]
    prod = member["production"]
    assert isinstance(prod, dict)
    for key in (
        "berry_amount",
        "ingredients",
        "skill_triggers",
        "inventory",
        "seconds_per_help",
        "helps_per_day",
        "berry",
        "berry_strength",
        "night_skill_chances",
        "inventory_fill_hours",
    ):
        assert key in prod, f"missing key {key!r} in member production"


def test_team_production_exposes_extra_tasty(client: TestClient) -> None:
    created = client.post("/team", json=valid_payload()).json()
    body = client.post(
        "/teams/production",
        json={"slots": _slots_json(created["id"]), "meals": [None, None, None]},
    ).json()
    # Sin main skill de Tasty Chance, la chance/multiplicador son la base del juego.
    assert body["extra_tasty_rate"] == pytest.approx(2.7 / 21)
    assert body["extra_tasty_multiplier"] == pytest.approx(24.6 / 21)


def test_team_production_endpoint_rejects_too_many(client: TestClient) -> None:
    ids = [client.post("/team", json=valid_payload()).json()["id"] for _ in range(6)]
    res = client.post(
        "/teams/production", json={"slots": _slots_json(*ids), "meals": [None, None, None]}
    )
    assert res.status_code == 400


def test_team_production_endpoint_with_recipe(client: TestClient) -> None:
    created = client.post("/team", json=valid_payload()).json()
    recipe = client.get("/recipes").json()[0]
    res = client.post(
        "/teams/production",
        json={
            "slots": _slots_json(created["id"]),
            "meals": [{"recipe": recipe["name"], "level": 1}, None, None],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["cooking_strength"] == recipe["base_strength"]
    assert body["grand_total_strength"] == body["total_strength"] + body["cooking_strength"]


def test_team_production_cooking_meals_have_breakdown_fields(client: TestClient) -> None:
    """cooking_meals incluye level, strength e ingredients (desglose X/Y por ingrediente)."""
    created = client.post("/team", json=valid_payload()).json()
    recipe = client.get("/recipes").json()[0]
    res = client.post(
        "/teams/production",
        json={
            "slots": _slots_json(created["id"]),
            "meals": [{"recipe": recipe["name"], "level": 2}, None, None],
        },
    )
    assert res.status_code == 200
    body = res.json()
    cooking_meals = body["cooking_meals"]
    assert len(cooking_meals) == 1

    meal = cooking_meals[0]
    # Campos nuevos presentes
    assert "level" in meal, "missing 'level' in cooking_meals[0]"
    assert "strength" in meal, "missing 'strength' in cooking_meals[0]"
    assert "ingredients" in meal, "missing 'ingredients' in cooking_meals[0]"

    # Tipos correctos
    assert isinstance(meal["level"], int)
    assert isinstance(meal["strength"], int)
    assert isinstance(meal["ingredients"], list)

    # Level coincide con lo enviado
    assert meal["level"] == 2

    # Hay al menos un ingrediente con los tres campos
    assert len(meal["ingredients"]) > 0
    first_ing = meal["ingredients"][0]
    assert "ingredient" in first_ing, "missing 'ingredient' key"
    assert "required" in first_ing, "missing 'required' key"
    assert "available" in first_ing, "missing 'available' key"
    assert isinstance(first_ing["ingredient"], str)
    assert isinstance(first_ing["required"], int)
    assert isinstance(first_ing["available"], (int, float))


def test_team_production_returns_skill_effects(client: TestClient) -> None:
    """/teams/production incluye skill_effects como lista de {kind, total, triggers}."""
    created = client.post("/team", json=valid_payload()).json()
    res = client.post(
        "/teams/production",
        json={"slots": _slots_json(created["id"]), "meals": [None, None, None]},
    )
    assert res.status_code == 200
    body = res.json()

    assert "skill_effects" in body, "missing 'skill_effects' in response"
    assert isinstance(body["skill_effects"], list)

    # Puede ser vacía (si la especie no activa ningún efecto) o tener entradas.
    for effect in body["skill_effects"]:
        assert "kind" in effect, "missing 'kind' in skill_effect entry"
        assert "total" in effect, "missing 'total' in skill_effect entry"
        assert "triggers" in effect, "missing 'triggers' in skill_effect entry"
        assert isinstance(effect["kind"], str)
        assert isinstance(effect["total"], (int, float))
        assert isinstance(effect["triggers"], (int, float))


def test_team_production_endpoint_split_slot(client: TestClient) -> None:
    a = client.post("/team", json=valid_payload()).json()["id"]
    b = client.post("/team", json=valid_payload()).json()["id"]
    full = client.post(
        "/teams/production",
        json={"slots": _slots_json(a), "meals": [None, None, None]},
    ).json()
    split = client.post(
        "/teams/production",
        json={
            "slots": [
                {"entries": [
                    {"member_id": a, "weight": 0.5},
                    {"member_id": b, "weight": 0.5},
                ]}
            ],
            "meals": [None, None, None],
        },
    ).json()
    # Dos copias al 50% en un slot ≈ un Pokémon completo.
    assert split["total_strength"] == pytest.approx(full["total_strength"])
    assert split["member_count"] == 2


def test_team_production_endpoint_rejects_weights_not_one(client: TestClient) -> None:
    a = client.post("/team", json=valid_payload()).json()["id"]
    b = client.post("/team", json=valid_payload()).json()["id"]
    res = client.post(
        "/teams/production",
        json={
            "slots": [
                {"entries": [
                    {"member_id": a, "weight": 0.5},
                    {"member_id": b, "weight": 0.4},
                ]}
            ],
            "meals": [None, None, None],
        },
    )
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# Task 5: islands en /catalog y campos base/bonus en /teams/production
# ---------------------------------------------------------------------------


def _create_member(client: TestClient) -> str:
    """Crea un miembro vía POST /team y devuelve su id."""
    return client.post("/team", json=valid_payload()).json()["id"]


def test_catalog_lists_islands(client: TestClient) -> None:
    body = client.get("/catalog").json()
    islands = {i["name"]: i for i in body["islands"]}
    assert len(islands) == 8
    assert islands["Cyan Beach"]["favorite_berries"] == ["Oran", "Pamtre", "Pecha"]
    assert islands["Cyan Beach"]["user_picks"] is False
    assert islands["Greengrass Isle"]["favorite_berries"] == []
    assert islands["Greengrass Isle"]["user_picks"] is True


def test_production_accepts_island_bonus_and_favorites(client: TestClient) -> None:
    member_id = _create_member(client)
    res = client.post(
        "/teams/production",
        json={
            "slots": _slots_json(member_id),
            "meals": [],
            "favorite_berries": ["Oran"],
            "island_bonus": 0.3,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["island_bonus"] == 0.3
    assert body["total_berry_strength"] == pytest.approx(
        body["total_berry_strength_base"] * 1.3
    )


def test_production_rejects_bonus_over_max(client: TestClient) -> None:
    member_id = _create_member(client)
    res = client.post(
        "/teams/production",
        json={"slots": _slots_json(member_id), "meals": [], "island_bonus": 0.9},
    )
    assert res.status_code in (400, 422)


def test_team_production_accepts_good_camp_ticket(client: TestClient) -> None:
    member_id = _create_member(client)
    off = client.post(
        "/teams/production",
        json={"slots": _slots_json(member_id), "meals": []},
    )
    on = client.post(
        "/teams/production",
        json={"slots": _slots_json(member_id), "meals": [], "good_camp_ticket": True},
    )
    assert off.status_code == 200
    assert on.status_code == 200
    off_member = off.json()["members"][0]["production"]
    on_member = on.json()["members"][0]["production"]
    # Con GCT ayuda más rápido → menos segundos por ayuda y más ayudas/día.
    assert on_member["seconds_per_help"] < off_member["seconds_per_help"]
    assert on_member["inventory"] > off_member["inventory"]
