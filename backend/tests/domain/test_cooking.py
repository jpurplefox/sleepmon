from sleepmon.domain.cooking import MealSelection, SlotIngredientStatus, plan_cooking
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


# ── Tests de desglose por ingrediente y fuerza por plato ─────────────────────

def test_slot_ingredient_available_greedy_aware() -> None:
    """×3 misma receta, producción = 2 porciones del ingrediente vinculante.

    Meal 1: available == required (remaining = 12 ≥ 6).
    Meal 2: available == required (remaining = 6 ≥ 6 after meal 1 subtracts).
    Meal 3: available < required (remaining = 0 < 6).
    """
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 2), MealSelection(r, 2), MealSelection(r, 2)]
    result = plan_cooking(meals, {I.HONEY: 12.0})  # exactamente 2 porciones

    slot0_ing = {s.ingredient: s for s in result.slots[0].ingredients}
    slot2_ing = {s.ingredient: s for s in result.slots[2].ingredients}

    # Meal 1: remaining=12 ≥ required=6 → available == required
    assert slot0_ing[I.HONEY].required == 6
    assert slot0_ing[I.HONEY].available == 6.0

    # Meal 3: remaining=0 < required=6 → available < required
    assert slot2_ing[I.HONEY].required == 6
    assert slot2_ing[I.HONEY].available == 0.0


def test_slot_feasibility_strength_and_level() -> None:
    """SlotFeasibility expone level y strength correctos para cada comida."""
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 3)]
    result = plan_cooking(meals, {I.HONEY: 100.0})

    assert result.slots[0].level == 1
    assert result.slots[0].strength == recipe_strength(r, 1)
    assert result.slots[1].level == 3
    assert result.slots[1].strength == recipe_strength(r, 3)


# ── Tests de SlotIngredientStatus y campos level/strength ────────────────────

def test_slot_feasibility_has_level_and_strength() -> None:
    """level y strength de SlotFeasibility reflejan el MealSelection pasado."""
    r = _recipe(base=200)
    level = 5
    meals = [MealSelection(r, level)]
    result = plan_cooking(meals, {I.HONEY: 20.0})
    assert result.slots[0].met is True
    assert result.slots[0].level == level
    assert result.slots[0].strength == recipe_strength(r, level)


def test_slot_feasibility_ingredients_greedy_breakdown() -> None:
    """Tres slots de la misma receta, producción exacta para 2 porciones.

    Slot 0: met=True, todo available==required.
    Slot 1: met=True, todo available==required.
    Slot 2: met=False, ingrediente vinculante available==0 (ya consumido).
    """
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    level = 3
    meals = [MealSelection(r, level), MealSelection(r, level), MealSelection(r, level)]
    # Producción exacta para 2 porciones del ingrediente vinculante.
    result = plan_cooking(meals, {I.HONEY: 12.0})

    # Slot 0: met y available == required
    s0 = result.slots[0]
    assert s0.met is True
    assert s0.level == level
    assert s0.strength == recipe_strength(r, level)
    assert len(s0.ingredients) == 1
    honey_s0 = s0.ingredients[0]
    assert isinstance(honey_s0, SlotIngredientStatus)
    assert honey_s0.ingredient == I.HONEY
    assert honey_s0.required == 6
    assert honey_s0.available == 6.0  # 12 disponibles, cap a 6

    # Slot 1: met y available == required (quedan 6 tras descontar slot 0)
    s1 = result.slots[1]
    assert s1.met is True
    honey_s1 = s1.ingredients[0]
    assert honey_s1.available == 6.0

    # Slot 2: no met, ingrediente vinculante available==0 (todo consumido)
    s2 = result.slots[2]
    assert s2.met is False
    honey_s2 = s2.ingredients[0]
    assert honey_s2.ingredient == I.HONEY
    assert honey_s2.required == 6
    assert honey_s2.available == 0.0  # remaining=0 tras los dos slots anteriores


def test_slot_feasibility_ingredients_partial_availability() -> None:
    """Slot con ingrediente parcialmente disponible: available < required, met=False."""
    r = _recipe(ings=((I.HONEY, 6), (I.FANCY_EGG, 4)), base=100)
    # Suficiente HONEY pero no FANCY_EGG
    result = plan_cooking([MealSelection(r, 1)], {I.HONEY: 10.0, I.FANCY_EGG: 2.0})
    s = result.slots[0]
    assert s.met is False
    by_ing = {si.ingredient: si for si in s.ingredients}
    assert by_ing[I.HONEY].available == 6.0   # cap a required
    assert by_ing[I.FANCY_EGG].available == 2.0  # solo 2 disponibles, required=4


def test_aggregate_fields_unchanged_by_new_slot_fields() -> None:
    """Los campos agregados (ingredients, surplus, cooking_strength) no cambian."""
    r = _recipe(ings=((I.HONEY, 6),), base=100)
    meals = [MealSelection(r, 1), MealSelection(r, 1), MealSelection(r, 1)]
    result = plan_cooking(meals, {I.HONEY: 12.0})
    # cooking_strength sigue sumando todos los slots (met o no)
    expected_strength = recipe_strength(r, 1) * 3
    assert result.cooking_strength == expected_strength
    # balance agregado intacto: 12 − 18 = −6
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].required == 18.0
    assert by_ing[I.HONEY].balance == -6.0
