"""Planificador de cocina del equipo (función pura, sin infraestructura).

Dadas las recetas elegidas para las comidas del día y los ingredientes que produce
el equipo, calcula: ingredientes requeridos vs producidos (con su balance), los
sobrantes (producidos que ninguna receta usa) y la fuerza aportada por las recetas.

La fuerza se cuenta SE CUMPLAN O NO los requisitos de ingredientes.

El cumplimiento (``met``) se evalúa **por plato individual**: una comida está
marcada como cumplida si la producción del equipo cubre los ingredientes de ESA
receta por sí sola (una porción), independientemente de las demás comidas elegidas.

Los balances de ingredientes (``ingredients``) se calculan contra la demanda máxima
por porción: para cada ingrediente, se toma el mayor requerimiento que tenga ese
ingrediente en cualquiera de las recetas elegidas (deduplicando recetas iguales).
Esto garantiza el invariante: ``all(s.met for s in result.slots)`` ⟺ no hay
``IngredientBalance`` con ``balance < 0``.
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
    """Si una comida tiene cubiertos sus ingredientes evaluados por porción individual.

    ``met`` es ``True`` cuando la producción del equipo cubre los ingredientes de
    ESTA receta sola (una porción), sin considerar las otras comidas elegidas.
    Garantiza el invariante: ``all(s.met for s in result.slots)`` ⟺ no hay
    ``IngredientBalance`` con ``balance < 0``.
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
    """Planifica la cocina del día con las comidas elegidas y lo producido.

    Modelo por porción individual:
    - ``required[ing]`` = máximo requerimiento de ese ingrediente en una sola porción
      de cualquiera de las recetas distintas elegidas (no suma entre comidas).
    - ``met`` por comida = la producción cubre esa receta sola (aislada).
    - ``cooking_strength`` = suma sobre TODOS los slots elegidos (3× la misma receta
      sigue sumando 3× la fuerza).
    """
    chosen = [m for m in meals if m is not None]

    # Deduplicar recetas distintas; para cada ingrediente tomar el MAX por porción.
    distinct_recipes: dict[str, Recipe] = {}
    for meal in chosen:
        distinct_recipes[meal.recipe.name] = meal.recipe

    required: dict[Ingredient, float] = {}
    for recipe in distinct_recipes.values():
        for ingredient, count in recipe.ingredients:
            if count > required.get(ingredient, 0.0):
                required[ingredient] = float(count)

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
    # (>0, usando el max por porción). Incluye los producidos que ninguna receta usa.
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

    # met por porción individual: la producción cubre esta receta sola.
    slots = tuple(
        SlotFeasibility(
            recipe_name=meal.recipe.name,
            met=all(
                produced.get(ing, 0.0) >= count
                for ing, count in meal.recipe.ingredients
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
