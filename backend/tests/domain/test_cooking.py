from sleepmon.domain.cooking import MealSelection, plan_cooking
from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741


def _recipe(name: str = "R", ings=((I.HONEY, 7),), base: int = 100) -> Recipe:
    return Recipe(name=name, type=RecipeType.CURRY, ingredients=tuple(ings), base_strength=base)


def test_plan_cooking_no_meals_is_zero() -> None:
    result = plan_cooking([None, None, None], {I.HONEY: 10.0})
    assert result.cooking_strength == 0.0
    assert result.ingredients == ()


def test_plan_cooking_sums_recipe_strength() -> None:
    meals = [MealSelection(_recipe(base=100), 1), MealSelection(_recipe(base=200), 1), None]
    result = plan_cooking(meals, {})
    assert result.cooking_strength == recipe_strength(_recipe(base=100), 1) + recipe_strength(
        _recipe(base=200), 1
    )


def test_plan_cooking_strength_counts_even_if_ingredients_missing() -> None:
    # Sin ingredientes producidos, la fuerza igual se cuenta.
    result = plan_cooking([MealSelection(_recipe(ings=((I.HONEY, 7),), base=100), 1)], {})
    assert result.cooking_strength == 100
    assert result.slots[0].met is False


def test_plan_cooking_required_vs_produced_balance() -> None:
    meals = [MealSelection(_recipe(ings=((I.HONEY, 7), (I.FANCY_EGG, 5)), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 10.0, I.FANCY_EGG: 2.0})
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].required == 7.0
    assert by_ing[I.HONEY].produced == 10.0
    assert by_ing[I.HONEY].balance == 3.0
    assert by_ing[I.FANCY_EGG].balance == -3.0  # falta
    assert result.slots[0].met is False  # falta fancy egg


def test_plan_cooking_surplus_lists_unused_produced() -> None:
    meals = [MealSelection(_recipe(ings=((I.HONEY, 2),), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0, I.MOOMOO_MILK: 4.0})
    surplus = {b.ingredient: b.balance for b in result.surplus}
    assert surplus[I.MOOMOO_MILK] == 4.0  # no usado por ninguna receta
    assert surplus[I.HONEY] == 3.0  # sobrante tras requerir 2
