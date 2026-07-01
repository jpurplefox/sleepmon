"""Planificador de cocina del equipo (función pura, sin infraestructura).

Dadas las recetas elegidas para las comidas del día y los ingredientes que produce
el equipo, calcula: ingredientes requeridos vs producidos (con su balance), los
sobrantes (producidos que ninguna receta usa) y la fuerza aportada por las recetas.

La fuerza se cuenta SE CUMPLAN O NO los requisitos de ingredientes.

El cumplimiento (``met``) se evalúa con **consumo secuencial en orden de slot**:
se parte de ``remaining = dict(produced)`` y se itera cada comida elegida en orden.
Antes de intentar cada comida se captura el snapshot de disponibilidad
(``available = max(0, min(remaining[ing], required))``). Luego ``met=True`` si
``remaining`` cubría TODOS los ingredientes de la receta antes de descontar.
Los ingredientes se restan de ``remaining`` **SIEMPRE**, independientemente de
``met``: una comida no cumplida consume igualmente sus ingredientes, de modo que
las comidas posteriores ven el pool ya depletado por las anteriores (cumplidas o no).
Esto responde "¿cuántas porciones quedan para cada comida teniendo en cuenta que
las comidas previas ya consumieron sus ingredientes?".

Los balances de ingredientes (``ingredients``) se calculan contra la **demanda
agregada total**: la suma de todos los slots elegidos (3× la misma receta requiere
3× los ingredientes). Esto garantiza el invariante:
``all(s.met for s in result.slots)`` ⟺ no hay ``IngredientBalance`` con
``balance < 0``.

Los sobrantes (``surplus``) son ingredientes producidos cuyo balance vs la demanda
agregada es positivo, incluyendo los producidos que ninguna receta usa.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient


@dataclass(frozen=True, slots=True)
class MealSelection:
    """Una comida elegida: qué receta y a qué nivel."""

    recipe: Recipe
    level: int


@dataclass(frozen=True, slots=True)
class IngredientBalance:
    """Balance de un ingrediente: requerido vs producido."""

    ingredient: Ingredient
    required: float
    produced: float
    balance: float  # produced - required (negativo = falta)


@dataclass(frozen=True, slots=True)
class SlotIngredientStatus:
    """Disponibilidad de un ingrediente para una comida concreta bajo consumo secuencial.

    ``available`` es ``max(0, min(remaining_before, required))``: cuánto de ese
    ingrediente había en el pool ANTES de que esta comida lo consumiera, acotado a
    [0, required]. Refleja lo que PODRÍA usar esta comida tras la depleción de todas
    las comidas anteriores (cumplidas o no).
    """

    ingredient: Ingredient
    required: int
    available: float  # max(0, min(remaining_before, required))


@dataclass(frozen=True, slots=True)
class SlotFeasibility:
    """Si una comida tiene cubiertos sus ingredientes bajo consumo secuencial.

    ``met`` es ``True`` cuando ``remaining`` (producción menos lo ya consumido
    por comidas anteriores en el día) cubría los ingredientes de esta receta
    ANTES de descontarlos. Los ingredientes se restan de ``remaining`` SIEMPRE,
    independientemente de ``met``, por lo que las comidas posteriores ven el pool
    depletado por TODAS las anteriores (cumplidas o no).

    ``ingredients`` captura el snapshot de disponibilidad ANTES de consumir esta
    comida (acotado a [0, required]), útil para mostrar "X/Y" en la UI.

    Garantiza el invariante: ``all(s.met for s in result.slots)`` ⟺ no hay
    ``IngredientBalance`` con ``balance < 0`` (vs la demanda agregada total).
    """

    recipe_name: str
    met: bool
    level: int
    strength: int
    ingredients: tuple[SlotIngredientStatus, ...]


@dataclass(frozen=True, slots=True)
class CookingResult:
    """Resultado del plan de cocina del día."""

    cooking_strength: float
    ingredients: tuple[IngredientBalance, ...]  # los requeridos por alguna receta
    surplus: tuple[IngredientBalance, ...]  # producidos no usados / sobrantes
    slots: tuple[SlotFeasibility, ...]


def plan_cooking(
    meals: Sequence[MealSelection | None],
    produced: Mapping[Ingredient, float],
) -> CookingResult:
    """Planifica la cocina del día con las comidas elegidas y lo producido.

    Modelo de consumo secuencial:
    - ``required[ing]`` = demanda AGREGADA total: suma de todos los slots elegidos.
      3× la misma receta requiere 3× los ingredientes.
    - ``met`` por comida (consumo secuencial, en orden de slot): se parte de
      remaining=produced. Para cada comida se registra el snapshot de disponibilidad
      ANTES de consumir (``available = max(0, min(remaining[ing], count))``). Luego
      ``met=True`` si remaining cubría todos los ingredientes ANTES de descontar.
      Los ingredientes se restan de ``remaining`` **SIEMPRE** (remaining puede
      volverse negativo), para que las comidas posteriores vean el pool depletado
      por todas las anteriores, cumplidas o no.
    - ``cooking_strength`` = suma sobre TODOS los slots elegidos (3× la misma
      receta sigue sumando 3× la fuerza, independientemente de met).
    """
    chosen = [m for m in meals if m is not None]

    # Demanda agregada: suma de todos los slots (3× la misma receta = 3× ingredientes)
    required: dict[Ingredient, float] = {}
    for meal in chosen:
        for ingredient, count in meal.recipe.ingredients:
            required[ingredient] = required.get(ingredient, 0.0) + float(count)

    ingredients = tuple(
        IngredientBalance(
            ingredient=ingredient,
            required=req,
            produced=produced.get(ingredient, 0.0),
            balance=produced.get(ingredient, 0.0) - req,
        )
        for ingredient, req in required.items()
    )

    # Sobrantes: ingredientes producidos con balance positivo vs la demanda agregada,
    # incluyendo los producidos que ninguna receta usa.
    surplus = tuple(
        IngredientBalance(
            ingredient=ingredient,
            required=required.get(ingredient, 0.0),
            produced=amount,
            balance=amount - required.get(ingredient, 0.0),
        )
        for ingredient, amount in produced.items()
        if amount - required.get(ingredient, 0.0) > 0
    )

    # Consumo secuencial en orden de slot: los ingredientes se restan SIEMPRE,
    # independientemente de si la comida se cumple o no. Remaining puede volverse
    # negativo; las comidas posteriores lo ven.
    remaining: dict[Ingredient, float] = dict(produced)
    slot_results: list[SlotFeasibility] = []
    for meal in chosen:
        # Snapshot de disponibilidad ANTES de consumir esta comida (capped a [0, required]).
        ing_statuses = tuple(
            SlotIngredientStatus(
                ingredient=ing,
                required=count,
                available=max(0.0, min(remaining.get(ing, 0.0), count)),
            )
            for ing, count in meal.recipe.ingredients
        )
        # met: el pool cubría todos los ingredientes antes de descontarlos.
        met = all(remaining.get(ing, 0.0) >= count for ing, count in meal.recipe.ingredients)
        # Restar SIEMPRE (remaining puede quedar negativo).
        for ing, count in meal.recipe.ingredients:
            remaining[ing] = remaining.get(ing, 0.0) - count
        slot_results.append(
            SlotFeasibility(
                recipe_name=meal.recipe.name,
                met=met,
                level=meal.level,
                strength=recipe_strength(meal.recipe, meal.level),
                ingredients=ing_statuses,
            )
        )

    slots = tuple(slot_results)

    cooking_strength = sum((recipe_strength(m.recipe, m.level) for m in chosen), 0.0)

    return CookingResult(
        cooking_strength=cooking_strength,
        ingredients=ingredients,
        surplus=surplus,
        slots=slots,
    )
