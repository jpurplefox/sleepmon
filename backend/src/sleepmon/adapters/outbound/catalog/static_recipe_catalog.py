"""Catálogo de recetas servido desde el dataset en código (``SEED_RECIPES``)."""

from __future__ import annotations

from collections.abc import Sequence

from sleepmon.domain.ports import RecipeCatalog
from sleepmon.domain.recipes import SEED_RECIPES, Recipe


class StaticRecipeCatalog(RecipeCatalog):
    """Implementación de solo lectura sobre el dataset semilla.

    El lookup por nombre es case-insensitive para tolerar el input del usuario.
    """

    def __init__(self, recipes: Sequence[Recipe] = SEED_RECIPES) -> None:
        self._by_name = {r.name.casefold(): r for r in recipes}
        self._all = tuple(recipes)

    def get(self, name: str) -> Recipe | None:
        return self._by_name.get(name.casefold())

    def all(self) -> Sequence[Recipe]:
        return self._all
