"""Saved teams use cases, plus detaching a deleted Box entry from its teams."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.dto import SavedSlotInput, SavedTeamInput, TeamMemberInput
from sleepmon.application.saved_team_service import DefaultSavedTeamService
from sleepmon.application.services import DefaultTeamService
from sleepmon.domain.errors import SavedTeamNotFoundError, TeamMemberNotFoundError, ValidationError
from sleepmon.domain.saved_team import SavedSlot
from sleepmon.domain.value_objects import Berry, Island, RecipeType, WeeklyBonus
from tests.fakes import (
    InMemoryPlayerProgressRepository,
    InMemorySavedTeamRepository,
    InMemoryTeamRepository,
)

USER = uuid4()
START = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


class StepClock:
    """Each call is one minute after the previous one, so saves are ordered."""

    def __init__(self) -> None:
        self.now = START

    def __call__(self) -> datetime:
        self.now += timedelta(minutes=1)
        return self.now


@dataclass
class World:
    saved: InMemorySavedTeamRepository
    box: DefaultTeamService
    teams: DefaultSavedTeamService
    clock: StepClock
    add_pokemon: Callable[[UUID], UUID]


@pytest.fixture
def world() -> World:
    members = InMemoryTeamRepository()
    saved = InMemorySavedTeamRepository()
    clock = StepClock()
    box = DefaultTeamService(
        members, StaticSpeciesCatalog(), InMemoryPlayerProgressRepository(), saved
    )
    teams = DefaultSavedTeamService(saved, members, StaticRecipeCatalog(), clock)

    def add_pokemon(user_id: UUID = USER) -> UUID:
        member = box.add_member(
            user_id,
            TeamMemberInput(
                species="Pikachu",
                level=30,
                nature="Adamant",
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            ),
        )
        return member.id

    return World(saved, box, teams, clock, add_pokemon)


def team_input(
    slots: Sequence[SavedSlotInput], name: str = "Cyan curry", **overrides: object
) -> SavedTeamInput:
    values: dict[str, object] = {
        "name": name,
        "slots": slots,
        "weekly_bonus": "berry_strength",
        "meals": ["Fancy Apple Curry", None, "Beanburger Curry"],
        "island": "Cyan Beach",
        "favorite_berries": ["Oran", "Pecha", "Leppa"],
        "main_favorite": None,
        "dish_type": "Curry",
    }
    values.update(overrides)
    return SavedTeamInput(**values)  # type: ignore[arg-type]


def single(member: UUID) -> SavedSlotInput:
    return SavedSlotInput(members=(member,), share=1.0)


# --- create -------------------------------------------------------------------


def test_create_parses_and_persists(world: World) -> None:
    a, b, c = world.add_pokemon(USER), world.add_pokemon(USER), world.add_pokemon(USER)
    created = world.teams.create(
        USER,
        team_input([single(a), SavedSlotInput((b, c), 0.6), single(a)], name="  Cyan curry  "),
    )
    assert created.name == "Cyan curry"
    assert created.slots == (SavedSlot((a,)), SavedSlot((b, c), 0.6), SavedSlot((a,)))
    assert created.island is Island.CYAN_BEACH
    assert created.favorite_berries == (Berry.ORAN, Berry.PECHA, Berry.LEPPA)
    assert created.weekly_bonus is WeeklyBonus.BERRY_STRENGTH
    assert created.dish_type is RecipeType.CURRY
    assert created.meals == ("Fancy Apple Curry", None, "Beanburger Curry")
    assert created.saved_at == world.clock.now
    assert world.teams.list(USER) == [created]


def test_a_single_slot_share_is_normalized(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(USER, team_input([SavedSlotInput((a,), 0.4)]))
    assert created.slots[0].share == 1.0


def test_recipe_names_take_the_catalogue_spelling(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(
        USER, team_input([single(a)], meals=["fancy apple curry", None, None])
    )
    assert created.meals == ("Fancy Apple Curry", None, None)


def test_no_map_no_dish_type_and_no_meals_are_valid(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(
        USER,
        team_input([single(a)], island=None, favorite_berries=[], dish_type=None, meals=[None] * 3),
    )
    assert created.island is None
    assert created.dish_type is None
    assert created.meals == (None, None, None)


def test_list_is_most_recently_saved_first(world: World) -> None:
    a = world.add_pokemon(USER)
    first = world.teams.create(USER, team_input([single(a)], name="First"))
    second = world.teams.create(USER, team_input([single(a)], name="Second"))
    assert [t.id for t in world.teams.list(USER)] == [second.id, first.id]
    world.teams.replace(USER, first.id, team_input([single(a)], name="First"))
    assert [t.id for t in world.teams.list(USER)] == [first.id, second.id]


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"name": "   "}, "no puede estar vacío"),
        ({"name": "x" * 41}, "hasta 40 caracteres"),
        ({"island": "Atlantis"}, "Mapa"),
        ({"favorite_berries": ["Oran", "Nope"]}, "Baya"),
        ({"favorite_berries": ["Oran", "Pecha", "Leppa", "Cheri"]}, "Como máximo 3"),
        ({"main_favorite": "Nope"}, "Baya principal"),
        ({"weekly_bonus": "double"}, "Bonus semanal"),
        ({"dish_type": "Soup"}, "Tipo de plato"),
        ({"meals": [None, None]}, "exactamente 3"),
        ({"meals": ["Mystery Stew", None, None]}, "No existe la receta"),
    ],
)
def test_invalid_input_is_rejected(
    world: World, overrides: dict[str, object], message: str
) -> None:
    a = world.add_pokemon(USER)
    with pytest.raises(ValidationError, match=message):
        world.teams.create(USER, team_input([single(a)], **overrides))
    assert world.teams.list(USER) == []


def test_slot_counts_are_enforced(world: World) -> None:
    a = world.add_pokemon(USER)
    with pytest.raises(ValidationError, match="al menos un Pokémon"):
        world.teams.create(USER, team_input([]))
    with pytest.raises(ValidationError, match="como máximo 5 slots"):
        world.teams.create(USER, team_input([single(a)] * 6))
    with pytest.raises(ValidationError, match="uno o dos"):
        world.teams.create(USER, team_input([SavedSlotInput((a, a, a), 0.5)]))
    with pytest.raises(ValidationError, match="entre 0 y 1"):
        world.teams.create(USER, team_input([SavedSlotInput((a, a), 1.0)]))


def test_every_member_must_be_in_the_users_box(world: World) -> None:
    mine = world.add_pokemon(USER)
    theirs = world.add_pokemon(uuid4())
    with pytest.raises(ValidationError, match="no está en tu Caja"):
        world.teams.create(USER, team_input([single(mine), single(theirs)]))
    with pytest.raises(ValidationError, match="no está en tu Caja"):
        world.teams.create(USER, team_input([SavedSlotInput((mine, uuid4()), 0.5)]))


# --- names --------------------------------------------------------------------


def test_a_name_is_unique_per_user_ignoring_case(world: World) -> None:
    a = world.add_pokemon(USER)
    world.teams.create(USER, team_input([single(a)], name="Cyan Curry"))
    with pytest.raises(ValidationError, match="Ya tenés un equipo llamado «cyan curry»"):
        world.teams.create(USER, team_input([single(a)], name="  cyan curry "))


def test_another_user_may_use_the_same_name(world: World) -> None:
    other = uuid4()
    world.teams.create(USER, team_input([single(world.add_pokemon(USER))]))
    created = world.teams.create(other, team_input([single(world.add_pokemon(other))]))
    assert created.name == "Cyan curry"


def test_saving_a_team_under_its_own_name_is_fine(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(USER, team_input([single(a)], name="Cyan curry"))
    replaced = world.teams.replace(USER, created.id, team_input([single(a)], name="CYAN curry"))
    assert replaced.name == "CYAN curry"


# --- replace ------------------------------------------------------------------


def test_replace_overwrites_everything_and_bumps_saved_at(world: World) -> None:
    a, b = world.add_pokemon(USER), world.add_pokemon(USER)
    created = world.teams.create(USER, team_input([single(a)]))
    replaced = world.teams.replace(
        USER,
        created.id,
        team_input([SavedSlotInput((a, b), 0.25)], name="Taupe", island=None, dish_type=None),
    )
    assert replaced.id == created.id
    assert replaced.name == "Taupe"
    assert replaced.slots == (SavedSlot((a, b), 0.25),)
    assert replaced.island is None
    assert replaced.saved_at > created.saved_at
    assert world.teams.list(USER) == [replaced]


def test_replace_cannot_take_another_teams_name(world: World) -> None:
    a = world.add_pokemon(USER)
    world.teams.create(USER, team_input([single(a)], name="Cyan"))
    taupe = world.teams.create(USER, team_input([single(a)], name="Taupe"))
    with pytest.raises(ValidationError, match="Ya tenés un equipo llamado"):
        world.teams.replace(USER, taupe.id, team_input([single(a)], name="cyan"))


def test_replace_of_a_missing_team_is_not_found(world: World) -> None:
    a = world.add_pokemon(USER)
    with pytest.raises(SavedTeamNotFoundError):
        world.teams.replace(USER, uuid4(), team_input([single(a)]))


def test_replace_of_another_users_team_is_not_found(world: World) -> None:
    other = uuid4()
    theirs = world.teams.create(other, team_input([single(world.add_pokemon(other))]))
    with pytest.raises(SavedTeamNotFoundError):
        world.teams.replace(USER, theirs.id, team_input([single(world.add_pokemon(USER))]))


# --- rename -------------------------------------------------------------------


def test_rename_changes_only_the_name(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(USER, team_input([single(a)]))
    renamed = world.teams.rename(USER, created.id, "  Beach curry ")
    assert renamed == replace(created, name="Beach curry")
    assert renamed.saved_at == created.saved_at
    assert world.teams.list(USER) == [renamed]


def test_rename_to_its_own_name_in_another_case_is_fine(world: World) -> None:
    created = world.teams.create(USER, team_input([single(world.add_pokemon(USER))]))
    assert world.teams.rename(USER, created.id, "CYAN CURRY").name == "CYAN CURRY"


def test_rename_follows_the_name_rules(world: World) -> None:
    a = world.add_pokemon(USER)
    world.teams.create(USER, team_input([single(a)], name="Taupe"))
    created = world.teams.create(USER, team_input([single(a)], name="Cyan"))
    with pytest.raises(ValidationError, match="no puede estar vacío"):
        world.teams.rename(USER, created.id, " ")
    with pytest.raises(ValidationError, match="hasta 40"):
        world.teams.rename(USER, created.id, "x" * 41)
    with pytest.raises(ValidationError, match="Ya tenés un equipo llamado «TAUPE»"):
        world.teams.rename(USER, created.id, "TAUPE")


def test_rename_of_a_missing_team_is_not_found(world: World) -> None:
    with pytest.raises(SavedTeamNotFoundError):
        world.teams.rename(USER, uuid4(), "Anything")


# --- delete -------------------------------------------------------------------


def test_delete_removes_the_team_and_leaves_the_box(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(USER, team_input([single(a)]))
    world.teams.delete(USER, created.id)
    assert world.teams.list(USER) == []
    assert world.box.get_member(USER, a).id == a


def test_delete_of_a_missing_team_is_not_found(world: World) -> None:
    with pytest.raises(SavedTeamNotFoundError):
        world.teams.delete(USER, uuid4())


def test_delete_of_another_users_team_is_not_found(world: World) -> None:
    other = uuid4()
    theirs = world.teams.create(other, team_input([single(world.add_pokemon(other))]))
    with pytest.raises(SavedTeamNotFoundError):
        world.teams.delete(USER, theirs.id)
    assert world.teams.list(other) == [theirs]


# --- deleting a Box entry detaches it -----------------------------------------


def test_deleting_a_box_entry_detaches_it_from_every_team(world: World) -> None:
    a, b, c = world.add_pokemon(USER), world.add_pokemon(USER), world.add_pokemon(USER)
    singles = world.teams.create(USER, team_input([single(a), single(b)], name="Singles"))
    split = world.teams.create(USER, team_input([SavedSlotInput((c, a), 0.6)], name="Split"))
    only_a = world.teams.create(
        USER, team_input([single(a), SavedSlotInput((a, a), 0.5)], name="Only A")
    )
    untouched = world.teams.create(USER, team_input([single(b)], name="Untouched"))

    world.box.delete_member(USER, a)

    by_name = {t.name: t for t in world.teams.list(USER)}
    assert set(by_name) == {"Singles", "Split", "Untouched"}
    assert by_name["Singles"].slots == (SavedSlot((b,)),)
    assert by_name["Singles"].saved_at == singles.saved_at
    assert by_name["Split"].slots == (SavedSlot((c,), 1.0),)
    assert by_name["Split"].id == split.id
    assert by_name["Untouched"] == untouched
    assert world.saved.get(only_a.id, USER) is None
    with pytest.raises(TeamMemberNotFoundError):
        world.box.get_member(USER, a)


def test_deleting_a_missing_box_entry_changes_nothing(world: World) -> None:
    a = world.add_pokemon(USER)
    created = world.teams.create(USER, team_input([single(a)]))
    with pytest.raises(TeamMemberNotFoundError):
        world.box.delete_member(USER, uuid4())
    assert world.teams.list(USER) == [created]


def test_deleting_a_box_entry_leaves_other_users_teams(world: World) -> None:
    other = uuid4()
    theirs = world.teams.create(other, team_input([single(world.add_pokemon(other))]))
    mine = world.add_pokemon(USER)
    world.box.delete_member(USER, mine)
    assert world.teams.list(other) == [theirs]
