"""Casos de uso del progreso del jugador (PRD 0011).

El dominio valida rangos; acá se valida la *identidad* contra el catálogo — que la
receta exista, que el tipo de plato y el área sean los del juego — antes de que el
merge puro del dominio corra.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from uuid import UUID

from sleepmon.application.dto import ProgressPatchInput
from sleepmon.application.services import _parse_enum
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.ports import PlayerProgressRepository, RecipeCatalog
from sleepmon.domain.progress import PlayerProgress, ProgressPatch, apply_patch
from sleepmon.domain.recipes import Recipe
from sleepmon.domain.value_objects import Island, RecipeType


class PlayerProgressService(ABC):
    """Puerto primario: leer y actualizar el progreso de un usuario."""

    @abstractmethod
    def get(self, user_id: UUID) -> PlayerProgress: ...

    @abstractmethod
    def patch(self, user_id: UUID, data: ProgressPatchInput) -> PlayerProgress: ...


class DefaultPlayerProgressService(PlayerProgressService):
    def __init__(self, repository: PlayerProgressRepository, recipes: RecipeCatalog) -> None:
        self._repository = repository
        self._recipes = recipes

    def get(self, user_id: UUID) -> PlayerProgress:
        return self._repository.get(user_id)

    def patch(self, user_id: UUID, data: ProgressPatchInput) -> PlayerProgress:
        parsed = self._parse(data)
        return self._repository.transform(user_id, lambda current: apply_patch(current, parsed))

    def _parse(self, data: ProgressPatchInput) -> ProgressPatch:
        return ProgressPatch(
            pot_size=data.pot_size,
            recipe_levels=self._parse_levels(data.recipe_levels),
            favorite_recipes=self._parse_favorites(data.favorite_recipes),
            area_bonuses=self._parse_bonuses(data.area_bonuses),
        )

    def _parse_levels(self, levels: Mapping[str, int] | None) -> Mapping[str, int] | None:
        if levels is None:
            return None
        for name in levels:
            self._require_recipe(name)
        return dict(levels)

    def _parse_favorites(
        self, favorites: Mapping[str, str | None] | None
    ) -> Mapping[RecipeType, str | None] | None:
        if favorites is None:
            return None
        parsed: dict[RecipeType, str | None] = {}
        for raw_type, name in favorites.items():
            dish_type = _parse_enum(RecipeType, raw_type, "Tipo de plato")
            if name is None:
                # Clearing a favorite names no recipe, so there is nothing to look up.
                parsed[dish_type] = None
                continue
            recipe = self._require_recipe(name)
            if recipe.type is not dish_type:
                raise ValidationError(
                    f"{name} es {recipe.type.value}, no puede ser la favorita de "
                    f"{dish_type.value}."
                )
            parsed[dish_type] = name
        return parsed

    def _parse_bonuses(self, bonuses: Mapping[str, int] | None) -> Mapping[Island, int] | None:
        if bonuses is None:
            return None
        return {
            _parse_enum(Island, raw_area, "Área"): pct for raw_area, pct in bonuses.items()
        }

    def _require_recipe(self, name: str) -> Recipe:
        recipe = self._recipes.get(name)
        if recipe is None:
            raise ValidationError(f"No existe la receta {name!r}.")
        return recipe
