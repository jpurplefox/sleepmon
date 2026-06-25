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


@pytest.fixture
def service() -> DefaultTeamService:
    return DefaultTeamService(InMemoryTeamRepository(), StaticSpeciesCatalog())


def valid_input(**overrides: object) -> TeamMemberInput:
    defaults: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": "Adamant",
        "ingredients": ["Fancy Apple", "Warming Ginger"],
        "sub_skills": ["Helping Speed S"],
    }
    defaults.update(overrides)
    return TeamMemberInput(**defaults)  # type: ignore[arg-type]


def test_add_member_persists_and_returns(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input())
    assert member.species == "Pikachu"
    assert service.get_member(member.id) == member
    assert len(service.list_members()) == 1


def test_species_lookup_is_case_insensitive(service: DefaultTeamService) -> None:
    member = service.add_member(valid_input(species="pikachu"))
    assert member.species == "Pikachu"  # se normaliza al nombre canónico del catálogo


def test_unknown_species_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(SpeciesNotFoundError):
        service.add_member(valid_input(species="Mewtwo"))


def test_invalid_nature_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(nature="Sleepy"))


def test_invalid_ingredient_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(ingredients=["Pizza"]))


def test_ingredient_not_valid_for_species_slot_rejected(service: DefaultTeamService) -> None:
    # Large Leek no es un ingrediente válido para Pikachu.
    with pytest.raises(ValidationError):
        service.add_member(valid_input(ingredients=["Large Leek"]))


def test_invalid_sub_skill_value_rejected(service: DefaultTeamService) -> None:
    with pytest.raises(ValidationError):
        service.add_member(valid_input(sub_skills=["Mega Helper XL"]))


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
        service.update_member(member.id, valid_input(ingredients=["Large Leek"]))


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
    service.add_member(valid_input(species="Squirtle", ingredients=["Moomoo Milk"], sub_skills=[]))
    dist = service.distributions()
    assert dist.natures["Adamant"] == 2
    assert dist.ingredients["Fancy Apple"] == 1
    assert dist.sub_skills["Helping Speed S"] == 1
    # Adamant: +Speed of Help, -Ingredient Finding; dos miembros Adamant.
    assert dist.nature_stats["Speed of Help"] == 2
    assert dist.nature_stats["Ingredient Finding"] == -2
