"""Planificador de cocina del equipo (función pura, sin infraestructura).

Dadas las recetas elegidas para las comidas del día y los ingredientes que produce
el equipo, calcula: ingredientes requeridos vs producidos (con su balance), los
sobrantes (producidos que ninguna receta usa) y la fuerza aportada por las recetas.

La fuerza se cuenta SE CUMPLAN O NO los requisitos de ingredientes; el cumplimiento
por comida es solo un indicador informativo (``met``).
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
    """Si una comida tiene cubiertos sus ingredientes con lo producido en el día.

    Cada comida se evalúa contra el producido total del día, sin descontar lo que
    requieren las otras comidas (indicador informativo).
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

    slots = tuple(
        SlotFeasibility(
            recipe_name=meal.recipe.name,
            met=all(
                produced.get(ingredient, 0.0) >= count
                for ingredient, count in meal.recipe.ingredients
            ),
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
