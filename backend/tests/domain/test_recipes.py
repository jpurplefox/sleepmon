import pytest

from sleepmon.domain.catalog_data import MAX_RECIPE_LEVEL, recipe_level_bonus
from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741


def _recipe(base: int = 100) -> Recipe:
    return Recipe(
        name="Test Curry",
        type=RecipeType.CURRY,
        ingredients=((I.HONEY, 7), (I.BEAN_SAUSAGE, 5)),
        base_strength=base,
    )


def test_recipe_strength_at_level_1_is_base() -> None:
    assert recipe_strength(_recipe(base=100), 1) == 100


def test_recipe_strength_grows_with_level() -> None:
    r = _recipe(base=100)
    assert recipe_strength(r, MAX_RECIPE_LEVEL) > recipe_strength(r, 1)


def test_recipe_strength_uses_level_bonus_multiplier() -> None:
    r = _recipe(base=200)
    assert recipe_strength(r, 10) == round(200 * recipe_level_bonus(10))


def test_recipe_strength_rejects_out_of_range_level() -> None:
    with pytest.raises(ValueError):
        recipe_strength(_recipe(), 0)
    with pytest.raises(ValueError):
        recipe_strength(_recipe(), MAX_RECIPE_LEVEL + 1)


def test_recipe_total_ingredients() -> None:
    assert _recipe().total_ingredients == 12
