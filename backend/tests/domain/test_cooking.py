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
    assert result.slots == ()


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


def test_met_reflects_aggregate_demand() -> None:
    # met se evalúa contra la demanda AGREGADA: dos comidas con la misma receta
    # duplican el requerimiento. Si el total supera lo producido, AMBAS comidas
    # deben ser met=False (coherente con el balance negativo del ingrediente).
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1)]  # HONEY total requerido: 12
    result = plan_cooking(meals, {I.HONEY: 8.0})  # producido 8 < requerido 12
    assert result.slots[0].met is False
    assert result.slots[1].met is False
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].balance == -4.0  # agregado: 8 - 12


def test_met_coherent_with_ingredient_balance() -> None:
    # Invariante: all(s.met) ⟺ no hay IngredientBalance con balance < 0.
    r = _recipe(ings=((I.HONEY, 6),), base=100)

    # Caso A: plan NO cumplible — met False y balance negativo
    meals_bad = [MealSelection(r, 1), MealSelection(r, 1)]
    result_bad = plan_cooking(meals_bad, {I.HONEY: 8.0})
    all_met_bad = all(s.met for s in result_bad.slots)
    has_shortfall_bad = any(b.balance < 0 for b in result_bad.ingredients)
    assert all_met_bad is False
    assert has_shortfall_bad is True

    # Caso B: plan cumplible — met True y sin faltantes
    meals_ok = [MealSelection(r, 1)]
    result_ok = plan_cooking(meals_ok, {I.HONEY: 10.0})
    all_met_ok = all(s.met for s in result_ok.slots)
    has_shortfall_ok = any(b.balance < 0 for b in result_ok.ingredients)
    assert all_met_ok is True
    assert has_shortfall_ok is False


def test_plan_cooking_surplus_lists_unused_produced() -> None:
    meals = [MealSelection(_recipe(ings=((I.HONEY, 2),), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0, I.MOOMOO_MILK: 4.0})
    surplus = {b.ingredient: b.balance for b in result.surplus}
    assert surplus[I.MOOMOO_MILK] == 4.0  # no usado por ninguna receta
    assert surplus[I.HONEY] == 3.0  # sobrante tras requerir 2
