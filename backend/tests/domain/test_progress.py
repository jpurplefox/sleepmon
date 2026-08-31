"""Player progress: validators, entity invariants and the pure patch merge."""

from __future__ import annotations

import pytest

from sleepmon.domain.catalog_data import POT_LADDER
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.progress import (
    PlayerProgress,
    ProgressPatch,
    apply_patch,
    validate_area_bonus,
    validate_pot_size,
    validate_recipe_level,
)
from sleepmon.domain.value_objects import Island, RecipeType


@pytest.mark.parametrize("size", POT_LADDER)
def test_every_ladder_rung_is_a_valid_pot(size: int) -> None:
    validate_pot_size(size)


@pytest.mark.parametrize("size", [20, 22, 34, 40, 82, 0, -3])
def test_off_ladder_pot_is_rejected(size: int) -> None:
    with pytest.raises(ValidationError):
        validate_pot_size(size)


def test_pot_rejects_bool_and_float() -> None:
    # True == 1 would otherwise slip past an int check.
    with pytest.raises(ValidationError):
        validate_pot_size(True)  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        validate_pot_size(21.0)  # type: ignore[arg-type]


@pytest.mark.parametrize("level", [1, 2, 35, 69, 70])
def test_recipe_level_in_range(level: int) -> None:
    validate_recipe_level(level)


@pytest.mark.parametrize("level", [0, -1, 71, 100])
def test_recipe_level_out_of_range(level: int) -> None:
    with pytest.raises(ValidationError):
        validate_recipe_level(level)


@pytest.mark.parametrize("pct", [0, 1, 42, 84, 85])
def test_area_bonus_in_range(pct: int) -> None:
    validate_area_bonus(pct)


@pytest.mark.parametrize("pct", [-1, 86, 120])
def test_area_bonus_out_of_range(pct: int) -> None:
    with pytest.raises(ValidationError):
        validate_area_bonus(pct)


def test_defaults_are_an_ordinary_starting_state() -> None:
    progress = PlayerProgress()
    assert progress.pot_size == 21
    assert progress.recipe_levels == {}
    assert progress.favorite_recipes == {}
    assert progress.area_bonuses == {}


def test_entity_validates_every_value_it_holds() -> None:
    with pytest.raises(ValidationError):
        PlayerProgress(pot_size=22)
    with pytest.raises(ValidationError):
        PlayerProgress(recipe_levels={"Beanburger Curry": 99})
    with pytest.raises(ValidationError):
        PlayerProgress(area_bonuses={Island.CYAN_BEACH: 99})


def test_an_absent_patch_field_is_untouched() -> None:
    current = PlayerProgress(pot_size=33, recipe_levels={"Beanburger Curry": 30})
    result = apply_patch(current, ProgressPatch(area_bonuses={Island.CYAN_BEACH: 42}))
    assert result.pot_size == 33
    assert result.recipe_levels == {"Beanburger Curry": 30}
    assert result.area_bonuses == {Island.CYAN_BEACH: 42}


def test_a_patch_merges_into_the_existing_mapping() -> None:
    current = PlayerProgress(recipe_levels={"Beanburger Curry": 30, "Fancy Apple Curry": 5})
    result = apply_patch(current, ProgressPatch(recipe_levels={"Beanburger Curry": 55}))
    assert result.recipe_levels == {"Beanburger Curry": 55, "Fancy Apple Curry": 5}


def test_a_level_back_to_the_default_removes_its_key() -> None:
    current = PlayerProgress(recipe_levels={"Beanburger Curry": 30})
    result = apply_patch(current, ProgressPatch(recipe_levels={"Beanburger Curry": 1}))
    assert result.recipe_levels == {}


def test_a_bonus_back_to_zero_removes_its_key() -> None:
    current = PlayerProgress(area_bonuses={Island.CYAN_BEACH: 42})
    result = apply_patch(current, ProgressPatch(area_bonuses={Island.CYAN_BEACH: 0}))
    assert result.area_bonuses == {}


def test_a_favorite_set_to_none_is_cleared() -> None:
    current = PlayerProgress(favorite_recipes={RecipeType.CURRY: "Beanburger Curry"})
    result = apply_patch(current, ProgressPatch(favorite_recipes={RecipeType.CURRY: None}))
    assert result.favorite_recipes == {}


def test_favorites_are_independent_per_type() -> None:
    current = PlayerProgress(favorite_recipes={RecipeType.CURRY: "Beanburger Curry"})
    result = apply_patch(
        current, ProgressPatch(favorite_recipes={RecipeType.DESSERT: "Clodsire Éclair"})
    )
    assert result.favorite_recipes == {
        RecipeType.CURRY: "Beanburger Curry",
        RecipeType.DESSERT: "Clodsire Éclair",
    }


def test_patch_validates_before_merging() -> None:
    with pytest.raises(ValidationError):
        apply_patch(PlayerProgress(), ProgressPatch(recipe_levels={"Beanburger Curry": 99}))
    with pytest.raises(ValidationError):
        apply_patch(PlayerProgress(), ProgressPatch(pot_size=40))


def test_apply_patch_does_not_mutate_the_input() -> None:
    current = PlayerProgress(recipe_levels={"Beanburger Curry": 30})
    apply_patch(current, ProgressPatch(recipe_levels={"Beanburger Curry": 55}))
    assert current.recipe_levels == {"Beanburger Curry": 30}
