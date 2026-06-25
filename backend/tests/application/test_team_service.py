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
