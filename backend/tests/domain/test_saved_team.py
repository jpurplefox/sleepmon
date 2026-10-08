"""Saved teams: name rules, slot shape, team invariants and detaching a Box entry."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.saved_team import (
    SavedSlot,
    SavedTeam,
    contains,
    name_key,
    normalize_name,
    validate_name,
    without_member,
)
from sleepmon.domain.value_objects import Berry, Island, RecipeType, WeeklyBonus

A, B, C = uuid4(), uuid4(), uuid4()
SAVED_AT = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


def team(*slots: SavedSlot, **overrides: object) -> SavedTeam:
    values: dict[str, object] = {
        "id": uuid4(),
        "name": "Cyan curry",
        "slots": slots or (SavedSlot((A,)),),
        "island": Island.CYAN_BEACH,
        "favorite_berries": (Berry.ORAN, Berry.PECHA, Berry.LEPPA),
        "main_favorite": None,
        "weekly_bonus": WeeklyBonus.BERRY_STRENGTH,
        "dish_type": RecipeType.CURRY,
        "meals": ("Fancy Apple Curry", None, None),
        "saved_at": SAVED_AT,
    }
    values.update(overrides)
    return SavedTeam(**values)  # type: ignore[arg-type]


# --- name ---------------------------------------------------------------------


def test_names_are_trimmed() -> None:
    assert normalize_name("  Cyan curry  ") == "Cyan curry"
    assert team(name="  Cyan curry ").name == "Cyan curry"


def test_names_compare_ignoring_case_and_spaces() -> None:
    assert name_key(" Cyan Curry") == name_key("cyan curry ")


@pytest.mark.parametrize("raw", ["", "   ", "\t"])
def test_an_empty_name_is_rejected(raw: str) -> None:
    with pytest.raises(ValidationError, match="no puede estar vacío"):
        validate_name(raw)


def test_forty_characters_is_the_limit() -> None:
    assert validate_name("x" * 40) == "x" * 40
    with pytest.raises(ValidationError, match="hasta 40 caracteres"):
        validate_name("x" * 41)


def test_the_limit_counts_after_trimming() -> None:
    assert validate_name("  " + "x" * 40 + "  ") == "x" * 40


# --- slots --------------------------------------------------------------------


def test_a_single_slot_always_has_the_whole_share() -> None:
    assert SavedSlot((A,), 0.3).share == 1.0


@pytest.mark.parametrize("share", [0.0, 1.0, -0.2, 1.5, float("nan"), float("inf")])
def test_a_split_share_must_be_strictly_between_0_and_1(share: float) -> None:
    with pytest.raises(ValidationError, match="entre 0 y 1"):
        SavedSlot((A, B), share)


def test_a_split_keeps_its_share() -> None:
    assert SavedSlot((A, B), 0.6).share == 0.6


@pytest.mark.parametrize("members", [(), (A, B, C)])
def test_a_slot_holds_one_or_two_members(members: tuple[UUID, ...]) -> None:
    with pytest.raises(ValidationError, match="uno o dos"):
        SavedSlot(members)


def test_the_same_entry_may_fill_both_halves_of_a_split() -> None:
    assert SavedSlot((A, A), 0.5).members == (A, A)


# --- team ---------------------------------------------------------------------


def test_a_team_needs_at_least_one_slot() -> None:
    with pytest.raises(ValidationError, match="al menos un Pokémon"):
        team(slots=())


def test_a_team_has_at_most_five_slots() -> None:
    assert len(team(*[SavedSlot((A,))] * 5).slots) == 5
    with pytest.raises(ValidationError, match="como máximo 5 slots"):
        team(*[SavedSlot((A,))] * 6)


def test_duplicated_slots_are_allowed() -> None:
    assert team(SavedSlot((A,)), SavedSlot((A,))).member_ids == {A}


def test_at_most_three_favorite_berries() -> None:
    with pytest.raises(ValidationError, match="Como máximo 3"):
        team(favorite_berries=(Berry.ORAN, Berry.PECHA, Berry.LEPPA, Berry.CHERI))


def test_favorite_berries_do_not_repeat() -> None:
    with pytest.raises(ValidationError, match="no pueden repetirse"):
        team(favorite_berries=(Berry.ORAN, Berry.ORAN))


def test_a_team_has_exactly_three_meals() -> None:
    with pytest.raises(ValidationError, match="exactamente 3"):
        team(meals=(None, None))


def test_no_map_and_no_dish_type_are_valid() -> None:
    bare = team(island=None, favorite_berries=(), dish_type=None, meals=(None, None, None))
    assert bare.island is None
    assert bare.dish_type is None


# --- contains / without_member ------------------------------------------------


def test_contains_finds_singles_and_splits() -> None:
    t = team(SavedSlot((A,)), SavedSlot((B, C), 0.6))
    assert contains(t, A)
    assert contains(t, C)
    assert not contains(t, uuid4())


def test_a_team_without_the_member_is_untouched() -> None:
    t = team(SavedSlot((A,)), SavedSlot((B, C), 0.6))
    assert without_member(t, uuid4()) is t


def test_a_single_slot_holding_it_is_removed() -> None:
    t = team(SavedSlot((A,)), SavedSlot((B,)), SavedSlot((A,)))
    result = without_member(t, A)
    assert result is not None
    assert result.slots == (SavedSlot((B,)),)


def test_a_split_collapses_to_the_other_member_at_100() -> None:
    t = team(SavedSlot((A, B), 0.6), SavedSlot((C, A), 0.3))
    result = without_member(t, A)
    assert result is not None
    assert result.slots == (SavedSlot((B,), 1.0), SavedSlot((C,), 1.0))


def test_a_split_filled_by_the_member_on_both_halves_is_removed() -> None:
    t = team(SavedSlot((A, A), 0.5), SavedSlot((B,)))
    result = without_member(t, A)
    assert result is not None
    assert result.slots == (SavedSlot((B,)),)


def test_a_team_left_without_slots_must_be_deleted() -> None:
    assert without_member(team(SavedSlot((A,)), SavedSlot((A, A), 0.4)), A) is None


def test_detaching_keeps_everything_else() -> None:
    t = team(SavedSlot((A,)), SavedSlot((B,)))
    result = without_member(t, A)
    assert result == replace(t, slots=(SavedSlot((B,)),))
    assert result is not None
    assert result.saved_at == SAVED_AT
