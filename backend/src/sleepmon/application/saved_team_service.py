"""Saved teams use cases (PRD 0016).

The domain holds the shape rules (name, slots, shares). Here we check what needs the
ports: that every member is one of the user's Box entries, that every meal is a real
recipe, and that no other team of the user already has the name.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from dataclasses import replace
from datetime import datetime
from uuid import UUID, uuid4

from sleepmon.application.dto import SavedTeamInput
from sleepmon.application.parsing import parse_enum
from sleepmon.domain.errors import SavedTeamNotFoundError, ValidationError
from sleepmon.domain.ports import RecipeCatalog, SavedTeamRepository, TeamRepository
from sleepmon.domain.saved_team import (
    MEALS_PER_TEAM,
    Meals,
    SavedSlot,
    SavedTeam,
    duplicate_name_error,
    name_key,
    validate_name,
)
from sleepmon.domain.value_objects import Berry, Island, RecipeType, WeeklyBonus


class SavedTeamService(ABC):
    """Primary port: list, save, rename and delete a user's saved teams."""

    @abstractmethod
    def list(self, user_id: UUID) -> list[SavedTeam]: ...

    @abstractmethod
    def create(self, user_id: UUID, data: SavedTeamInput) -> SavedTeam: ...

    @abstractmethod
    def replace(self, user_id: UUID, team_id: UUID, data: SavedTeamInput) -> SavedTeam: ...

    @abstractmethod
    def rename(self, user_id: UUID, team_id: UUID, name: str) -> SavedTeam: ...

    @abstractmethod
    def delete(self, user_id: UUID, team_id: UUID) -> None: ...


class DefaultSavedTeamService(SavedTeamService):
    def __init__(
        self,
        repository: SavedTeamRepository,
        members: TeamRepository,
        recipes: RecipeCatalog,
        clock: Callable[[], datetime],
    ) -> None:
        self._repo = repository
        self._members = members
        self._recipes = recipes
        self._clock = clock

    def list(self, user_id: UUID) -> list[SavedTeam]:
        return self._repo.list(user_id)

    def create(self, user_id: UUID, data: SavedTeamInput) -> SavedTeam:
        team = self._build(user_id, uuid4(), data)
        self._repo.add(team, user_id)
        return team

    def replace(self, user_id: UUID, team_id: UUID, data: SavedTeamInput) -> SavedTeam:
        self._require(user_id, team_id)
        team = self._build(user_id, team_id, data)
        if not self._repo.update(team, user_id):
            raise SavedTeamNotFoundError(str(team_id))
        return team

    def rename(self, user_id: UUID, team_id: UUID, name: str) -> SavedTeam:
        current = self._require(user_id, team_id)
        normalized = validate_name(name)
        self._require_unique_name(user_id, normalized, team_id)
        # A rename is not a save: saved_at stays where it was.
        renamed = replace(current, name=normalized)
        if not self._repo.update(renamed, user_id):
            raise SavedTeamNotFoundError(str(team_id))
        return renamed

    def delete(self, user_id: UUID, team_id: UUID) -> None:
        if not self._repo.delete(team_id, user_id):
            raise SavedTeamNotFoundError(str(team_id))

    def _require(self, user_id: UUID, team_id: UUID) -> SavedTeam:
        team = self._repo.get(team_id, user_id)
        if team is None:
            raise SavedTeamNotFoundError(str(team_id))
        return team

    def _build(self, user_id: UUID, team_id: UUID, data: SavedTeamInput) -> SavedTeam:
        team = SavedTeam(
            id=team_id,
            name=data.name,
            slots=tuple(SavedSlot(tuple(s.members), s.share) for s in data.slots),
            island=None if data.island is None else parse_enum(Island, data.island, "Mapa"),
            favorite_berries=tuple(parse_enum(Berry, b, "Baya") for b in data.favorite_berries),
            main_favorite=(
                None
                if data.main_favorite is None
                else parse_enum(Berry, data.main_favorite, "Baya principal")
            ),
            weekly_bonus=parse_enum(WeeklyBonus, data.weekly_bonus, "Bonus semanal"),
            dish_type=(
                None
                if data.dish_type is None
                else parse_enum(RecipeType, data.dish_type, "Tipo de plato")
            ),
            meals=self._parse_meals(data.meals),
            saved_at=self._clock(),
        )
        self._require_unique_name(user_id, team.name, team_id)
        self._require_box_members(user_id, team)
        return team

    def _parse_meals(self, meals: Sequence[str | None]) -> Meals:
        if len(meals) != MEALS_PER_TEAM:
            raise ValidationError(f"Un equipo lleva exactamente {MEALS_PER_TEAM} comidas.")
        names: list[str | None] = []
        for name in meals:
            if name is None:
                names.append(None)
                continue
            recipe = self._recipes.get(name)
            if recipe is None:
                raise ValidationError(f"No existe la receta {name!r}.")
            # The catalogue's own spelling, whatever casing the client sent.
            names.append(recipe.name)
        return (names[0], names[1], names[2])

    def _require_unique_name(self, user_id: UUID, name: str, own_id: UUID) -> None:
        key = name_key(name)
        for other in self._repo.list(user_id):
            if other.id != own_id and name_key(other.name) == key:
                raise duplicate_name_error(name)

    def _require_box_members(self, user_id: UUID, team: SavedTeam) -> None:
        for member_id in team.member_ids:
            if self._members.get(member_id, user_id) is None:
                raise ValidationError("Ese Pokémon no está en tu Caja.")
