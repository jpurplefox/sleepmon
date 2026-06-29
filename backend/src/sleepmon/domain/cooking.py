"""Planificador de cocina del equipo (función pura, sin infraestructura).

Dadas las recetas elegidas para las comidas del día y los ingredientes que produce
el equipo, calcula: ingredientes requeridos vs producidos (con su balance), los
sobrantes (producidos que ninguna receta usa) y la fuerza aportada por las recetas.

La fuerza se cuenta SE CUMPLAN O NO los requisitos de ingredientes. El cumplimiento
(``met``) se evalúa de forma agregada: una comida está marcada como cumplida solo si
la demanda total del plan (suma de todas las comidas) está cubierta por la producción
del equipo; es decir, ``met`` es idéntico para todas las comidas del plan.
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
class SlotFeasibility:
    """Si una comida tiene cubiertos sus ingredientes con la demanda agregada del plan.

    ``met`` es ``True`` solo cuando TODOS los ingredientes del plan (suma de todas las
    comidas elegidas) están cubiertos por lo producido, garantizando el invariante:
    ``all(s.met for s in result.slots)`` ⟺ no hay ``IngredientBalance`` con
    ``balance < 0``.
    """

    recipe_name: str
    met: bool


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
    """Planifica la cocina del día con las comidas elegidas y lo producido."""
    chosen = [m for m in meals if m is not None]

    required: dict[Ingredient, float] = {}
    for meal in chosen:
        for ingredient, count in meal.recipe.ingredients:
            required[ingredient] = required.get(ingredient, 0.0) + count

    ingredients = tuple(
        IngredientBalance(
            ingredient=ingredient,
            required=req,
            produced=produced.get(ingredient, 0.0),
            balance=produced.get(ingredient, 0.0) - req,
        )
        for ingredient, req in required.items()
    )

    # Sobrantes: por ingrediente producido, lo que queda tras cubrir lo requerido
    # (>0). Incluye los producidos que ninguna receta usa.
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

    # met se evalúa contra la demanda AGREGADA del plan completo (required ya
    # acumula todos los ingredientes de todas las comidas). Una comida está
    # "cumplida" solo si el equipo puede cubrir el total del plan.
    all_met = all(produced.get(ing, 0.0) >= req for ing, req in required.items())
    slots = tuple(
        SlotFeasibility(
            recipe_name=meal.recipe.name,
            met=all_met,
        )
        for meal in chosen
    )

    cooking_strength = sum((recipe_strength(m.recipe, m.level) for m in chosen), 0.0)

    return CookingResult(
        cooking_strength=cooking_strength,
        ingredients=ingredients,
        surplus=surplus,
        slots=slots,
    )
