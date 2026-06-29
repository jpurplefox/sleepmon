from sleepmon.domain.cooking import MealSelection, plan_cooking
from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741


def _recipe(name: str = "R", ings=((I.HONEY, 7),), base: int = 100) -> Recipe:
    return Recipe(name=name, type=RecipeType.CURRY, ingredients=tuple(ings), base_strength=base)


# ── Tests básicos que deben seguir pasando ───────────────────────────────────

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
    # Una sola comida: required = demanda de esa receta (1 slot).
    meals = [MealSelection(_recipe(ings=((I.HONEY, 7), (I.FANCY_EGG, 5)), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 10.0, I.FANCY_EGG: 2.0})
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].required == 7.0
    assert by_ing[I.HONEY].produced == 10.0
    assert by_ing[I.HONEY].balance == 3.0
    assert by_ing[I.FANCY_EGG].balance == -3.0  # falta
    assert result.slots[0].met is False  # falta fancy egg


# ── Tests del modelo greedy ───────────────────────────────────────────────────

def test_same_recipe_three_slots_produced_two_servings_third_not_met() -> None:
    """×3 misma receta, producción exacta para 2 porciones del ingrediente
    vinculante → primeras dos met=True, tercera met=False.
    El balance agregado para ese ingrediente es negativo (producido − 3×count).
    """
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {I.HONEY: 12.0})  # exactamente 2 porciones
    assert result.slots[0].met is True
    assert result.slots[1].met is True
    assert result.slots[2].met is False
    # Demanda agregada = 3×6 = 18; balance = 12 − 18 = −6
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].required == 18.0
    assert by_ing[I.HONEY].balance == -6.0


def test_same_recipe_three_slots_produced_enough_for_three_all_met() -> None:
    """×3 misma receta, producción ≥ 3 porciones → todas met=True, sin balance negativo."""
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {I.HONEY: 18.0})  # exactamente 3 porciones
    assert all(s.met for s in result.slots)
    assert not any(b.balance < 0 for b in result.ingredients)


def test_same_recipe_three_slots_produced_less_than_one_serving_none_met() -> None:
    """×3 misma receta, producción < 1 porción → ninguna met=True.
    El faltante en balance muestra el ×3 completo de demanda.
    """
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0})  # menos que 1 porción
    assert all(s.met is False for s in result.slots)
    by_ing = {b.ingredient: b for b in result.ingredients}
    # Demanda agregada = 18; faltante = 5 − 18 = −13
    assert by_ing[I.HONEY].required == 18.0
    assert by_ing[I.HONEY].balance == -13.0


def test_greedy_ordering_expensive_first_flips_later_slot() -> None:
    """Orden greedy: la primera comida (cara) consume ingredientes compartidos
    y la segunda (más barata) queda sin cubrir porque no sobra.

    R1 necesita 8 HONEY, R2 necesita 5 HONEY.
    Producimos 8: greedy cubre R1 (8≥8, remaining=0), luego R2 falla (0<5).
    Si el orden fuera al revés R2 se cubriría primero.
    """
    r1 = _recipe(name="R1", ings=((I.HONEY, 8),), base=100)
    r2 = _recipe(name="R2", ings=((I.HONEY, 5),), base=100)
    meals = [MealSelection(r1, 1), MealSelection(r2, 1)]
    result = plan_cooking(meals, {I.HONEY: 8.0})
    assert result.slots[0].met is True   # R1 cubierta
    assert result.slots[1].met is False  # R2 no cubierta — sin remaining
    # Demanda agregada = 13; balance = 8 − 13 = −5
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].balance == -5.0


def test_invariant_all_met_iff_no_negative_balance() -> None:
    """Invariante: all(s.met) ⟺ no hay IngredientBalance con balance < 0."""
    r = _recipe(ings=((I.HONEY, 6),), base=100)

    # Caso A: plan NO cumplible — met=False y balance negativo
    result_bad = plan_cooking(
        [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)],
        {I.HONEY: 11.0},  # menos de 3 porciones; primera ok, segunda falla
    )
    # Con 11 HONEY y 6 por porción: primera ok (11−6=5), segunda ok (5−6<0? no, 5<6 → falla)
    # Realmente: primera ok(11≥6 → remaining=5), segunda falla(5<6), tercera falla
    assert result_bad.slots[0].met is True
    assert result_bad.slots[1].met is False
    assert result_bad.slots[2].met is False
    assert not all(s.met for s in result_bad.slots)
    assert any(b.balance < 0 for b in result_bad.ingredients)

    # Caso B: plan cumplible — todas met=True y sin faltantes
    result_ok = plan_cooking(
        [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)],
        {I.HONEY: 18.0},  # exactamente 3 porciones
    )
    assert all(s.met for s in result_ok.slots)
    assert not any(b.balance < 0 for b in result_ok.ingredients)


def test_cooking_strength_sums_all_slots_unchanged() -> None:
    """cooking_strength = suma sobre TODOS los slots (3× la misma receta = 3× fuerza)."""
    r = _recipe(base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {})
    expected = recipe_strength(r, 1) * 3
    assert result.cooking_strength == expected


def test_plan_cooking_surplus_lists_unused_produced() -> None:
    """Sobrantes con demanda agregada: 1 slot con 2 HONEY → surplus = 3 (5−2)."""
    meals = [MealSelection(_recipe(ings=((I.HONEY, 2),), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0, I.MOOMOO_MILK: 4.0})
    surplus = {b.ingredient: b.balance for b in result.surplus}
    assert surplus[I.MOOMOO_MILK] == 4.0  # no usado por ninguna receta
    assert surplus[I.HONEY] == 3.0  # sobrante tras requerir 2 (1 slot)
