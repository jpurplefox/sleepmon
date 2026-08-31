"""Player progress use cases: catalogue validation on top of the domain's merge."""

from __future__ import annotations

from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.dto import ProgressPatchInput
from sleepmon.application.progress_service import DefaultPlayerProgressService
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Island, RecipeType
from tests.fakes import InMemoryPlayerProgressRepository

USER = uuid4()


@pytest.fixture
def service() -> DefaultPlayerProgressService:
    return DefaultPlayerProgressService(
        InMemoryPlayerProgressRepository(), StaticRecipeCatalog()
    )


def test_a_user_with_no_row_reads_the_defaults(
    service: DefaultPlayerProgressService,
) -> None:
    progress = service.get(USER)
    assert progress.pot_size == 21
    assert progress.recipe_levels == {}
    assert progress.favorite_recipes == {}
    assert progress.area_bonuses == {}


def test_patching_one_field_leaves_the_rest_alone(
    service: DefaultPlayerProgressService,
) -> None:
    service.patch(USER, ProgressPatchInput(pot_size=33))
    result = service.patch(USER, ProgressPatchInput(area_bonuses={"Cyan Beach": 42}))
    assert result.pot_size == 33
    assert result.area_bonuses == {Island.CYAN_BEACH: 42}


def test_string_keys_become_domain_enums(service: DefaultPlayerProgressService) -> None:
    result = service.patch(
        USER,
        ProgressPatchInput(
            favorite_recipes={"Curry": "Beanburger Curry"},
            area_bonuses={"Lapis Lakeside": 40},
        ),
    )
    assert result.favorite_recipes == {RecipeType.CURRY: "Beanburger Curry"}
    assert result.area_bonuses == {Island.LAPIS_LAKESIDE: 40}


def test_an_unknown_recipe_is_rejected(service: DefaultPlayerProgressService) -> None:
    with pytest.raises(ValidationError):
        service.patch(USER, ProgressPatchInput(recipe_levels={"Nonexistent Stew": 30}))


def test_an_unknown_favorite_recipe_is_rejected(
    service: DefaultPlayerProgressService,
) -> None:
    with pytest.raises(ValidationError):
        service.patch(USER, ProgressPatchInput(favorite_recipes={"Curry": "Nonexistent Stew"}))


def test_a_favorite_of_the_wrong_type_is_rejected(
    service: DefaultPlayerProgressService,
) -> None:
    # Beanburger Curry is a Curry; naming it the favorite Salad is a real mistake.
    with pytest.raises(ValidationError):
        service.patch(USER, ProgressPatchInput(favorite_recipes={"Salad": "Beanburger Curry"}))


def test_an_unknown_dish_type_is_rejected(service: DefaultPlayerProgressService) -> None:
    with pytest.raises(ValidationError):
        service.patch(USER, ProgressPatchInput(favorite_recipes={"Soup": "Beanburger Curry"}))


def test_an_unknown_area_is_rejected(service: DefaultPlayerProgressService) -> None:
    with pytest.raises(ValidationError):
        service.patch(USER, ProgressPatchInput(area_bonuses={"Atlantis": 40}))


def test_clearing_a_favorite_needs_no_catalogue_lookup(
    service: DefaultPlayerProgressService,
) -> None:
    service.patch(USER, ProgressPatchInput(favorite_recipes={"Curry": "Beanburger Curry"}))
    result = service.patch(USER, ProgressPatchInput(favorite_recipes={"Curry": None}))
    assert result.favorite_recipes == {}


def test_an_off_ladder_pot_is_rejected(service: DefaultPlayerProgressService) -> None:
    with pytest.raises(ValidationError):
        service.patch(USER, ProgressPatchInput(pot_size=40))


def test_progress_is_isolated_per_user(service: DefaultPlayerProgressService) -> None:
    other = uuid4()
    service.patch(USER, ProgressPatchInput(pot_size=33))
    assert service.get(other).pot_size == 21
