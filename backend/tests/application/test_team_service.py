from collections.abc import Sequence
from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.dto import (
    MealSelectionInput,
    ProductionInput,
    TeamMemberInput,
    TeamProductionInput,
)
from sleepmon.application.services import DefaultTeamService
from sleepmon.domain.catalog_data import MAX_RECIPE_LEVEL
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import (
    SpeciesNotFoundError,
    TeamMemberNotFoundError,
    ValidationError,
)
from sleepmon.domain.ports import SpeciesCatalog
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Ingredient
from tests.fakes import InMemoryTeamRepository


@pytest.fixture
def service() -> DefaultTeamService:
    return DefaultTeamService(
        InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
    )


def valid_input(**overrides: object) -> TeamMemberInput:
    defaults: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": "Adamant",
        "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        "sub_skills": ["Helping Speed S"],
    }
    defaults.update(overrides)
    return TeamMemberInput(**defaults)  # type: ignore[arg-type]


def test_add_member_persists_and_returns(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input())
    assert member.species == "Pikachu"
    assert service.get_member(member.id) == member
    assert len(service.list_members()) == 1


def test_list_members_with_production(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input())
    rows = service.list_members_with_production()
    assert len(rows) == 1
    m, production = rows[0]
    assert m.id == member.id
    assert production is not None
    # Producción real, derivada del mismo cálculo del dominio que /production.
    assert production.berries > 0
    assert production.skill_triggers >= 0
    # La producción cuenta solo los slots de ingrediente desbloqueados por nivel
    # (a nivel 30, slots 1 y 2): puede ser menos que los 3 ingredientes cargados.
    assert 1 <= len(production.ingredients) <= len(member.ingredients)
    assert production.ingredients_total == pytest.approx(
        sum(s.amount for s in production.ingredients)
    )


def test_species_lookup_is_case_insensitive(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input(species="pikachu"))
    assert member.species == "Pikachu"  # se normaliza al nombre canónico del catálogo


def test_unknown_species_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(SpeciesNotFoundError):
        service.add_member(valid_input(species="Mewtwo"))


def test_invalid_nature_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(nature="Sleepy"))


def test_add_member_without_nature(service: DefaultTeamService) -> None:
    # naturaleza opcional: nature="" se traduce a None ("sin naturaleza").
    member = service.add_member(valid_input(nature=""))
    assert member.nature is None
    # No aporta a la distribución de naturalezas.
    assert service.distributions().natures == {}


def test_invalid_ingredient_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(ingredients=["Pizza"]))


def test_ingredient_not_valid_for_species_slot_rejected(service: DefaultTeamService) -> None:
    # Large Leek no es un ingrediente válido para Pikachu (en el primer slot).
    with pytest.raises(ValidationError):
        service.add_member(
            valid_input(ingredients=["Large Leek", "Warming Ginger", "Fancy Egg"])
        )


def test_invalid_sub_skill_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(sub_skills=["Mega Helper XL"]))


def test_invalid_ribbon_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(ribbon="9999h"))


def test_more_ingredients_than_species_slots_rejected(service: DefaultTeamService) -> None:
    # Pikachu tiene 3 slots; cuatro ingredientes debe dar ValidationError, no reventar.
    with pytest.raises(ValidationError):
        service.add_member(
            valid_input(
                level=60,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Apple", "Warming Ginger"],
            )
        )


def test_level_1_can_have_all_three_ingredients(service: DefaultTeamService) -> None:
    # Los ingredientes ya están definidos: se registran los 3 aunque sea nivel 1.
    member = service.add_member(
        valid_input(
            level=1,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            sub_skills=[],  # nivel 1 no tiene slots de sub skill todavía
        )
    )
    assert len(member.ingredients) == 3


def test_get_missing_member_raises(service: DefaultTeamService) -> None:
    with pytest.raises(TeamMemberNotFoundError):
        service.get_member(uuid4())


def test_update_member_replaces_fields(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input())
    updated = service.update_member(member.id, valid_input(level=60, nature="Modest"))
    assert updated.id == member.id
    assert updated.level == 60
    assert updated.nature.value == "Modest"


def test_update_missing_member_raises(service: DefaultTeamService) -> None:
    with pytest.raises(TeamMemberNotFoundError):
        service.update_member(uuid4(), valid_input())


def test_update_with_invalid_ingredient_rejected(service: DefaultTeamService) -> None:
    # La revalidación vía _build_member(member_id=...) también rechaza datos inválidos.
    member = service.add_member(valid_input())
    with pytest.raises(ValidationError):
        service.update_member(
            member.id, valid_input(ingredients=["Large Leek", "Warming Ginger", "Fancy Egg"])
        )


def test_update_changing_species_revalidates_ingredients_against_new_slots(
    service: DefaultTeamService,
) -> None:
    # Fancy Apple es válido para Pikachu pero NO para Squirtle: al cambiar de
    # especie en el update, los ingredientes se revalidan contra los slots nuevos.
    member = service.add_member(
        valid_input(species="Pikachu", ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"])
    )
    with pytest.raises(ValidationError):
        service.update_member(
            member.id,
            valid_input(
                species="Squirtle", ingredients=["Fancy Apple", "Soothing Cacao", "Bean Sausage"]
            ),
        )


def test_update_changing_species_preserves_id_and_accepts_valid_ingredients(
    service: DefaultTeamService,
) -> None:
    member = service.add_member(
        valid_input(species="Pikachu", ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"])
    )
    squirtle_ingredients = ["Moomoo Milk", "Soothing Cacao", "Bean Sausage"]
    updated = service.update_member(
        member.id, valid_input(species="Squirtle", ingredients=squirtle_ingredients)
    )
    assert updated.id == member.id  # el id se preserva pese al cambio de especie
    assert updated.species == "Squirtle"
    assert [i.value for i in updated.ingredients] == squirtle_ingredients


def test_short_species_reports_three_slots_and_rejects_overflow(
    service: DefaultTeamService,
) -> None:
    # Mareep tiene 2 ingredientes pero igual ofrece 3 slots: 3 se aceptan,
    # 4 disparan el error con el conteo correcto.
    member = service.add_member(
        valid_input(species="Mareep", ingredients=["Fiery Herb", "Fancy Egg", "Fancy Egg"])
    )
    assert len(member.ingredients) == 3
    with pytest.raises(ValidationError, match="solo tiene 3 slots"):
        service.add_member(
            valid_input(
                species="Mareep",
                ingredients=["Fiery Herb", "Fancy Egg", "Fancy Egg", "Fancy Egg"],
            )
        )


def test_compute_production_returns_estimate(service: DefaultTeamService) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Pikachu", level=60, ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"]
        )
    )
    assert result.helps_per_day > 0
    assert result.berry == "Grepa"  # baya de Pikachu
    assert [s.ingredient for s in result.ingredients] == [
        "Fancy Apple",
        "Warming Ginger",
        "Fancy Egg",
    ]


def test_compute_production_only_unlocked_slots_at_low_level(service: DefaultTeamService) -> None:
    # Nivel 1: solo el primer slot de ingrediente desbloqueado.
    result = service.compute_production(
        ProductionInput(
            species="Pikachu", level=1, ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"]
        )
    )
    assert [s.ingredient for s in result.ingredients] == ["Fancy Apple"]


def test_compute_production_unknown_species_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(SpeciesNotFoundError):
        service.compute_production(
            ProductionInput(
                species="Mewtwo",
                level=60,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_compute_production_requires_three_ingredients(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.compute_production(
            ProductionInput(
                species="Pikachu", level=30, ingredients=["Fancy Apple", "Warming Ginger"]
            )
        )


def test_compute_production_invalid_level_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=0,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_compute_production_rejects_duplicate_sub_skills(service: DefaultTeamService) -> None:
    # Mismas invariantes que add_member: las sub skills repetidas se rechazan (antes
    # se colaban y sesgaban el cálculo sumando el bonus dos veces).
    with pytest.raises(ValidationError, match="repetir"):
        service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=80,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
                sub_skills=["Helping Speed M", "Helping Speed M"],
            )
        )


def test_compute_production_rejects_too_many_sub_skills(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=80,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
                sub_skills=[
                    "Helping Speed M",
                    "Inventory Up S",
                    "Skill Trigger S",
                    "Ingredient Finder S",
                    "Berry Finding S",
                    "Helping Bonus",
                ],  # 6 > 5
            )
        )


def test_compute_production_accepts_nature_and_ribbon(service: DefaultTeamService) -> None:
    # Cubre el parseo de nature y ribbon no-vacíos por la ruta de compute_production
    # (las demás llamadas usan los defaults vacíos).
    result = service.compute_production(
        ProductionInput(
            species="Pikachu",
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            nature="Adamant",
            ribbon="500h",
        )
    )
    assert result.helps_per_day > 0


def test_compute_production_rejects_non_int_level(service: DefaultTeamService) -> None:
    # bool es subtipo de int (True == 1): se rechaza igual que en TeamMember.
    with pytest.raises(ValidationError):
        service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=True,  # type: ignore[arg-type]
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_compute_production_invalid_ingredient_for_slot_rejected(
    service: DefaultTeamService,
) -> None:
    with pytest.raises(ValidationError):
        service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=60,
                ingredients=["Large Leek", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_distributions_empty_team(service: DefaultTeamService) -> None:
    dist = service.distributions()
    assert dist.natures == {}
    assert dist.ingredients == {}
    assert dist.sub_skills == {}
    # nature_stats nunca es {}: trae todos los stats en 0.
    assert dist.nature_stats == {
        "Speed of Help": 0,
        "Ingredient Finding": 0,
        "Energy Recovery": 0,
        "EXP Gains": 0,
        "Main Skill Chance": 0,
    }


def test_delete_member(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input())
    service.delete_member(member.id)
    assert service.list_members() == []


def test_delete_missing_member_raises(service: DefaultTeamService) -> None:
    with pytest.raises(TeamMemberNotFoundError):
        service.delete_member(uuid4())


def test_distributions_aggregate_team(service: DefaultTeamService) -> None:
    service.add_member(valid_input())
    service.add_member(
        valid_input(
            species="Squirtle",
            ingredients=["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            sub_skills=[],
        )
    )
    dist = service.distributions()
    assert dist.natures["Adamant"] == 2
    assert dist.ingredients["Fancy Apple"] == 1
    assert dist.sub_skills["Helping Speed S"] == 1
    # Adamant: +Speed of Help, -Ingredient Finding; dos miembros Adamant.
    assert dist.nature_stats["Speed of Help"] == 2
    assert dist.nature_stats["Ingredient Finding"] == -2


def test_skill_level_persists_through_service(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input(skill_level=6))
    assert member.skill_level == 6
    assert service.get_member(member.id).skill_level == 6


def test_skill_level_defaults_to_one(service: DefaultTeamService) -> None:
    assert service.add_member(valid_input()).skill_level == 1


def test_skill_level_out_of_range_rejected_on_add(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(skill_level=9))


def test_production_skill_level_out_of_range_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.compute_production(
            ProductionInput(
                species="Crustle",
                level=60,
                ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
                skill_level=0,
            )
        )


def test_compute_production_includes_skill_ingredients_for_crustle(
    service: DefaultTeamService,
) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
            skill_level=7,
        )
    )
    pool = {s.ingredient for s in result.skill_ingredients}
    assert pool == {"Glossy Avocado", "Soft Potato", "Pure Oil"}
    expected_each = result.skill_triggers * 18 / 3
    for slot in result.skill_ingredients:
        assert slot.amount == pytest.approx(expected_each)


def test_compute_production_no_skill_ingredients_for_non_draw_species(
    service: DefaultTeamService,
) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Pikachu",
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        )
    )
    assert result.skill_ingredients == []


def test_compute_production_includes_skill_energy_for_sylveon(
    service: DefaultTeamService,
) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Sylveon",
            level=60,
            ingredients=["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            skill_level=6,
        )
    )
    assert result.skill_energy is not None
    assert result.skill_energy == pytest.approx(result.skill_triggers * 18)
    assert result.skill_ingredients == []  # E4E no produce ingredientes


def test_compute_production_no_skill_energy_for_non_e4e(service: DefaultTeamService) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
            skill_level=7,
        )
    )
    assert result.skill_energy is None


def test_compute_production_includes_skill_ingredient_total_for_magnet(
    service: DefaultTeamService,
) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Bulbasaur",  # Ingredient Magnet S
            level=60,
            ingredients=["Honey", "Snoozy Tomato", "Soft Potato"],
            skill_level=7,
        )
    )
    assert result.skill_ingredient_total is not None
    assert result.skill_ingredient_total == pytest.approx(result.skill_triggers * 24)
    assert result.skill_ingredients == []  # no se desglosa por tipo
    assert result.skill_energy is None


def test_compute_production_no_skill_ingredient_total_for_non_magnet(
    service: DefaultTeamService,
) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
        )
    )
    assert result.skill_ingredient_total is None


def test_compute_production_includes_cooking_ingredients_for_flareon(
    service: DefaultTeamService,
) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Flareon",  # Cooking Power-Up S
            level=60,
            ingredients=["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            skill_level=7,
        )
    )
    assert result.skill_cooking_ingredients is not None
    assert result.skill_cooking_ingredients == pytest.approx(result.skill_triggers * 31)
    assert result.skill_ingredients == []
    assert result.skill_energy is None
    assert result.skill_ingredient_total is None


def test_compute_production_includes_skill_strength_for_charge_strength(
    service: DefaultTeamService,
) -> None:
    # Pikachu tiene Charge Strength S (monto fijo).
    result = service.compute_production(
        ProductionInput(
            species="Pikachu",
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            skill_level=7,
        )
    )
    assert result.skill_strength is not None
    assert result.skill_strength == pytest.approx(result.skill_triggers * 3212)


def test_compute_production_charge_strength_m(service: DefaultTeamService) -> None:
    # Mareep tiene Charge Strength M.
    result = service.compute_production(
        ProductionInput(
            species="Mareep",
            level=60,
            ingredients=["Fiery Herb", "Fancy Egg", "Fancy Egg"],
            skill_level=7,
        )
    )
    assert result.skill_strength == pytest.approx(result.skill_triggers * 6858)


def test_compute_production_no_skill_strength_for_non_charge(service: DefaultTeamService) -> None:
    result = service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
        )
    )
    assert result.skill_strength is None


def test_compute_production_includes_self_energy_for_charge_energy(
    service: DefaultTeamService,
) -> None:
    # Rattata tiene Charge Energy S.
    result = service.compute_production(
        ProductionInput(
            species="Rattata",
            level=60,
            ingredients=["Fancy Apple", "Greengrass Soybeans", "Bean Sausage"],
            skill_level=6,
        )
    )
    assert result.skill_self_energy is not None
    assert result.skill_self_energy == pytest.approx(result.skill_triggers * 43)
    assert result.skill_energy is None  # no es energía al equipo


def test_compute_production_includes_dream_shards_for_meowth(
    service: DefaultTeamService,
) -> None:
    # Meowth tiene Dream Shard Magnet S (monto fijo). Nivel de skill 8.
    result = service.compute_production(
        ProductionInput(
            species="Meowth",
            level=60,
            ingredients=["Moomoo Milk", "Moomoo Milk", "Moomoo Milk"],
            skill_level=8,
        )
    )
    assert result.skill_dream_shards is not None
    assert result.skill_dream_shards == pytest.approx(result.skill_triggers * 2500)


# ---------------------------------------------------------------------------
# compute_team_production
# ---------------------------------------------------------------------------


def _service_tp() -> DefaultTeamService:
    return DefaultTeamService(
        InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
    )


def _add_pikachu(svc: DefaultTeamService) -> str:
    member = svc.add_member(
        TeamMemberInput(
            species="Pikachu",
            level=30,
            nature="Adamant",
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            sub_skills=[],
        )
    )
    return str(member.id)


def test_compute_team_production_aggregates_members() -> None:
    svc = _service_tp()
    mid = _add_pikachu(svc)
    result = svc.compute_team_production(
        TeamProductionInput(member_ids=[mid], meals=[None, None, None])
    )
    assert result.member_count == 1
    assert result.total_strength > 0
    assert result.grand_total_strength == result.total_strength  # sin cocina


def test_compute_team_production_adds_cooking_to_grand_total() -> None:
    svc = _service_tp()
    mid = _add_pikachu(svc)
    recipe = svc.list_recipes()[0]
    result = svc.compute_team_production(
        TeamProductionInput(
            member_ids=[mid],
            meals=[MealSelectionInput(recipe=recipe.name, level=1), None, None],
        )
    )
    assert result.cooking_strength == recipe.base_strength  # nivel 1 = base
    assert result.grand_total_strength == result.total_strength + result.cooking_strength


def test_compute_team_production_rejects_missing_member() -> None:
    svc = _service_tp()
    with pytest.raises(TeamMemberNotFoundError):
        svc.compute_team_production(
            TeamProductionInput(
                member_ids=["00000000-0000-0000-0000-000000000000"], meals=[None, None, None]
            )
        )


def test_compute_team_production_rejects_too_many_members() -> None:
    svc = _service_tp()
    ids = [_add_pikachu(svc) for _ in range(6)]
    with pytest.raises(ValidationError):
        svc.compute_team_production(TeamProductionInput(member_ids=ids, meals=[None, None, None]))


def test_compute_team_production_rejects_duplicate_members() -> None:
    svc = _service_tp()
    mid = _add_pikachu(svc)
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(member_ids=[mid, mid], meals=[None, None, None])
        )


def test_compute_team_production_rejects_unknown_recipe() -> None:
    svc = _service_tp()
    mid = _add_pikachu(svc)
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(
                member_ids=[mid], meals=[MealSelectionInput(recipe="No Existe", level=1)]
            )
        )


def test_compute_team_production_rejects_recipe_level_out_of_range() -> None:
    svc = _service_tp()
    mid = _add_pikachu(svc)
    recipe = svc.list_recipes()[0]
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(
                member_ids=[mid],
                meals=[MealSelectionInput(recipe=recipe.name, level=0)],
            )
        )
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(
                member_ids=[mid],
                meals=[MealSelectionInput(recipe=recipe.name, level=MAX_RECIPE_LEVEL + 1)],
            )
        )


class _EmptySpeciesCatalog(SpeciesCatalog):
    def get(self, name: str) -> Species | None:
        return None

    def all(self) -> Sequence[Species]:
        return ()


def test_compute_team_production_excludes_off_catalog_members() -> None:
    repo = InMemoryTeamRepository()
    member = TeamMember(
        species="Pikachu",
        level=30,
        nature=None,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
    )
    repo.add(member)
    svc = DefaultTeamService(repo, _EmptySpeciesCatalog(), StaticRecipeCatalog())
    result = svc.compute_team_production(
        TeamProductionInput(member_ids=[str(member.id)], meals=[None, None, None])
    )
    assert result.excluded_count == 1
    assert result.member_count == 0
    assert result.total_strength == 0.0
