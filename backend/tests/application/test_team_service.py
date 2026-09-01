from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.application.dto import TeamMemberInput
from sleepmon.application.services import DefaultTeamService
from sleepmon.domain.errors import (
    SpeciesNotFoundError,
    TeamMemberNotFoundError,
    ValidationError,
)
from tests.fakes import InMemoryTeamRepository

UID = uuid4()
"""Usuario fijo para los tests que no ejercitan el aislamiento entre usuarios
(cada test arma su propio repo/servicio, así que reusar un id es seguro)."""


@pytest.fixture
def service() -> DefaultTeamService:
    return DefaultTeamService(InMemoryTeamRepository(), StaticSpeciesCatalog())


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
    member = service.add_member(UID, valid_input())
    assert member.species == "Pikachu"
    assert service.get_member(UID, member.id) == member
    assert len(service.list_members(UID)) == 1


def test_service_passes_user_id_to_repo() -> None:
    repo = InMemoryTeamRepository()
    service = DefaultTeamService(repo, StaticSpeciesCatalog())
    uid = uuid4()
    created = service.add_member(uid, valid_input())
    assert service.get_member(uid, created.id).id == created.id
    other = uuid4()
    with pytest.raises(TeamMemberNotFoundError):
        service.get_member(other, created.id)


def test_list_members_with_production(service: DefaultTeamService) -> None:
    member = service.add_member(UID, valid_input())
    rows = service.list_members_with_production(UID)
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
    member = service.add_member(UID, valid_input(species="pikachu"))
    assert member.species == "Pikachu"  # se normaliza al nombre canónico del catálogo


def test_unknown_species_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(SpeciesNotFoundError):
        service.add_member(UID, valid_input(species="Mewtwo"))


def test_invalid_nature_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(UID, valid_input(nature="Sleepy"))


def test_add_member_without_nature(service: DefaultTeamService) -> None:
    # naturaleza opcional: nature="" se traduce a None ("sin naturaleza").
    member = service.add_member(UID, valid_input(nature=""))
    assert member.nature is None
    # No aporta a la distribución de naturalezas.
    assert service.distributions(UID).natures == {}


def test_invalid_ingredient_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(UID, valid_input(ingredients=["Pizza"]))


def test_ingredient_not_valid_for_species_slot_rejected(service: DefaultTeamService) -> None:
    # Large Leek no es un ingrediente válido para Pikachu (en el primer slot).
    with pytest.raises(ValidationError):
        service.add_member(
            UID, valid_input(ingredients=["Large Leek", "Warming Ginger", "Fancy Egg"])
        )


def test_invalid_sub_skill_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(UID, valid_input(sub_skills=["Mega Helper XL"]))


def test_invalid_ribbon_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(UID, valid_input(ribbon="9999h"))


def test_more_ingredients_than_species_slots_rejected(service: DefaultTeamService) -> None:
    # Pikachu tiene 3 slots; cuatro ingredientes debe dar ValidationError, no reventar.
    with pytest.raises(ValidationError):
        service.add_member(
            UID,
            valid_input(
                level=60,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Apple", "Warming Ginger"],
            ),
        )


def test_level_1_can_have_all_three_ingredients(service: DefaultTeamService) -> None:
    # Los ingredientes ya están definidos: se registran los 3 aunque sea nivel 1.
    member = service.add_member(
        UID,
        valid_input(
            level=1,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            sub_skills=[],  # nivel 1 no tiene slots de sub skill todavía
        ),
    )
    assert len(member.ingredients) == 3


def test_get_missing_member_raises(service: DefaultTeamService) -> None:
    with pytest.raises(TeamMemberNotFoundError):
        service.get_member(UID, uuid4())


def test_update_member_replaces_fields(service: DefaultTeamService) -> None:
    member = service.add_member(UID, valid_input())
    updated = service.update_member(UID, member.id, valid_input(level=60, nature="Modest"))
    assert updated.id == member.id
    assert updated.level == 60
    assert updated.nature.value == "Modest"


def test_update_missing_member_raises(service: DefaultTeamService) -> None:
    with pytest.raises(TeamMemberNotFoundError):
        service.update_member(UID, uuid4(), valid_input())


def test_update_with_invalid_ingredient_rejected(service: DefaultTeamService) -> None:
    # La revalidación vía _build_member(member_id=...) también rechaza datos inválidos.
    member = service.add_member(UID, valid_input())
    with pytest.raises(ValidationError):
        service.update_member(
            UID, member.id, valid_input(ingredients=["Large Leek", "Warming Ginger", "Fancy Egg"])
        )


def test_update_changing_species_revalidates_ingredients_against_new_slots(
    service: DefaultTeamService,
) -> None:
    # Fancy Apple es válido para Pikachu pero NO para Squirtle: al cambiar de
    # especie en el update, los ingredientes se revalidan contra los slots nuevos.
    member = service.add_member(
        UID,
        valid_input(species="Pikachu", ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"]),
    )
    with pytest.raises(ValidationError):
        service.update_member(
            UID,
            member.id,
            valid_input(
                species="Squirtle", ingredients=["Fancy Apple", "Soothing Cacao", "Bean Sausage"]
            ),
        )


def test_update_changing_species_preserves_id_and_accepts_valid_ingredients(
    service: DefaultTeamService,
) -> None:
    member = service.add_member(
        UID,
        valid_input(species="Pikachu", ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"]),
    )
    squirtle_ingredients = ["Moomoo Milk", "Soothing Cacao", "Bean Sausage"]
    updated = service.update_member(
        UID, member.id, valid_input(species="Squirtle", ingredients=squirtle_ingredients)
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
        UID, valid_input(species="Mareep", ingredients=["Fiery Herb", "Fancy Egg", "Fancy Egg"])
    )
    assert len(member.ingredients) == 3
    with pytest.raises(ValidationError, match="solo tiene 3 slots"):
        service.add_member(
            UID,
            valid_input(
                species="Mareep",
                ingredients=["Fiery Herb", "Fancy Egg", "Fancy Egg", "Fancy Egg"],
            ),
        )


def test_distributions_empty_team(service: DefaultTeamService) -> None:
    dist = service.distributions(UID)
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
    member = service.add_member(UID, valid_input())
    service.delete_member(UID, member.id)
    assert service.list_members(UID) == []


def test_delete_missing_member_raises(service: DefaultTeamService) -> None:
    with pytest.raises(TeamMemberNotFoundError):
        service.delete_member(UID, uuid4())


def test_distributions_aggregate_team(service: DefaultTeamService) -> None:
    service.add_member(UID, valid_input())
    service.add_member(
        UID,
        valid_input(
            species="Squirtle",
            ingredients=["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            sub_skills=[],
        ),
    )
    dist = service.distributions(UID)
    assert dist.natures["Adamant"] == 2
    assert dist.ingredients["Fancy Apple"] == 1
    assert dist.sub_skills["Helping Speed S"] == 1
    # Adamant: +Speed of Help, -Ingredient Finding; dos miembros Adamant.
    assert dist.nature_stats["Speed of Help"] == 2
    assert dist.nature_stats["Ingredient Finding"] == -2


def test_skill_level_persists_through_service(service: DefaultTeamService) -> None:
    member = service.add_member(UID, valid_input(skill_level=6))
    assert member.skill_level == 6
    assert service.get_member(UID, member.id).skill_level == 6


def test_skill_level_defaults_to_one(service: DefaultTeamService) -> None:
    assert service.add_member(UID, valid_input()).skill_level == 1


def test_skill_level_out_of_range_rejected_on_add(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(UID, valid_input(skill_level=9))
