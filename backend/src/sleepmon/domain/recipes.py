"""Catálogo de recetas (datos de referencia que viajan con el código).

Cada receta fija su tipo (curry/salad/dessert), los ingredientes requeridos con su
cantidad y su fuerza base. La fuerza efectiva de un plato es la base por el
multiplicador del nivel de la receta (``recipe_strength``).

Dataset completo del juego, sourceado de nitoyon (``pokesleep-tool``) y nerolis-lab
(sleepapi). Ampliarlo o corregirlo es agregar/editar entradas de ``SEED_RECIPES``.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.catalog_data import recipe_level_bonus
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741 — alias local para que el dataset se lea compacto


@dataclass(frozen=True, slots=True)
class Recipe:
    """Entrada del catálogo para una receta."""

    name: str
    type: RecipeType
    # Ingredientes requeridos con su cantidad, en orden de display del juego.
    ingredients: tuple[tuple[Ingredient, int], ...]
    base_strength: int  # fuerza base a nivel 1 (sin bonus)

    @property
    def total_ingredients(self) -> int:
        """Total de unidades de ingrediente que pide la receta."""
        return sum(count for _, count in self.ingredients)


def recipe_strength(recipe: Recipe, level: int) -> int:
    """Fuerza de ``recipe`` cocinada a nivel ``level`` (1..MAX_RECIPE_LEVEL)."""
    return round(recipe.base_strength * recipe_level_bonus(level))


# Dataset semilla. Completar con el catálogo completo en la Task 2.
SEED_RECIPES: tuple[Recipe, ...] = ()
