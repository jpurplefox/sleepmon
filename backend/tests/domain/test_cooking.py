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


# ── Nuevos tests del modelo por porción individual ──────────────────────────────

def test_same_recipe_three_slots_produced_one_serving_all_met() -> None:
    """Misma receta en los 3 slots + producción = 1 porción → todas met=True.

    Cocinar 3× la misma receta NO incrementa el requerimiento de ingredientes.
    """
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {I.HONEY: 6.0})  # exactamente 1 porción
    assert all(s.met for s in result.slots)
    assert not any(b.balance < 0 for b in result.ingredients)


def test_same_recipe_three_slots_short_one_ingredient_all_not_met() -> None:
    """Misma receta ×3, producción 1 unidad por debajo de 1 porción → all met=False.

    El déficit en balance es el de 1 porción (no ×3).
    """
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0})  # 1 unidad menos que 1 porción
    assert all(s.met is False for s in result.slots)
    by_ing = {b.ingredient: b for b in result.ingredients}
    # Déficit = 1 porción menos 1 unidad = -1 (no -3 como daría el modelo agregado)
    assert by_ing[I.HONEY].balance == -1.0


def test_two_distinct_recipes_each_coverable_both_met() -> None:
    """Dos recetas distintas, cada una cubierta por separado, pero su SUMA no.

    Con el modelo agregado ambas serían not-met. Con el modelo por porción, ambas met.
    """
    r1 = _recipe(name="R1", ings=((I.HONEY, 5),), base=100)
    r2 = _recipe(name="R2", ings=((I.HONEY, 4),), base=100)
    # Producimos 5 HONEY: cubre R1 (5≥5) y R2 (5≥4), pero no la suma (9).
    meals = [MealSelection(r1, 1), MealSelection(r2, 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0})
    assert result.slots[0].met is True  # R1 cubierta
    assert result.slots[1].met is True  # R2 cubierta
    # required = max(5, 4) = 5; balance = 5 - 5 = 0
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].required == 5.0
    assert by_ing[I.HONEY].balance == 0.0


def test_coherence_invariant_all_met_iff_no_negative_balance() -> None:
    """Invariante: all(s.met) ⟺ no hay IngredientBalance con balance < 0."""
    r = _recipe(ings=((I.HONEY, 6),), base=100)

    # Caso A: plan NO cumplible — met=False y balance negativo
    result_bad = plan_cooking(
        [MealSelection(r, 1), MealSelection(r, 1)],
        {I.HONEY: 5.0},
    )
    assert all(s.met for s in result_bad.slots) is False
    assert any(b.balance < 0 for b in result_bad.ingredients) is True

    # Caso B: plan cumplible — met=True y sin faltantes
    result_ok = plan_cooking(
        [MealSelection(r, 1), MealSelection(r, 1)],
        {I.HONEY: 6.0},
    )
    assert all(s.met for s in result_ok.slots) is True
    assert any(b.balance < 0 for b in result_ok.ingredients) is False


def test_cooking_strength_sums_all_slots_unchanged() -> None:
    """cooking_strength = suma sobre TODOS los slots (3× la misma receta = 3× fuerza)."""
    r = _recipe(base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {})
    expected = recipe_strength(r, 1) * 3
    assert result.cooking_strength == expected


def test_plan_cooking_surplus_lists_unused_produced() -> None:
    meals = [MealSelection(_recipe(ings=((I.HONEY, 2),), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0, I.MOOMOO_MILK: 4.0})
    surplus = {b.ingredient: b.balance for b in result.surplus}
    assert surplus[I.MOOMOO_MILK] == 4.0  # no usado por ninguna receta
    assert surplus[I.HONEY] == 3.0  # sobrante tras requerir 2
