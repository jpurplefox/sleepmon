"""Puertos secundarios (driven): interfaces que la infraestructura implementa.

El dominio y la aplicación dependen de estas abstracciones, nunca de psycopg ni de
ningún detalle de almacenamiento (DIP).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from uuid import UUID

from sleepmon.domain.entities import TeamMember
from sleepmon.domain.recipes import Recipe
from sleepmon.domain.species import Species


class SpeciesCatalog(ABC):
    """Acceso de solo lectura al catálogo de especies."""

    @abstractmethod
    def get(self, name: str) -> Species | None:
        """Devuelve la especie por nombre, o ``None`` si no está en el catálogo."""

    @abstractmethod
    def all(self) -> Sequence[Species]:
        """Todas las especies del catálogo."""


class RecipeCatalog(ABC):
    """Acceso de solo lectura al catálogo de recetas."""

    @abstractmethod
    def get(self, name: str) -> Recipe | None:
        """Devuelve la receta por nombre, o ``None`` si no está en el catálogo."""

    @abstractmethod
    def all(self) -> Sequence[Recipe]:
        """Todas las recetas del catálogo."""


class TeamRepository(ABC):
    """Persistencia de los miembros del equipo."""

    @abstractmethod
    def add(self, member: TeamMember) -> None: ...

    @abstractmethod
    def get(self, member_id: UUID) -> TeamMember | None: ...

    @abstractmethod
    def list(self) -> list[TeamMember]: ...

    @abstractmethod
    def update(self, member: TeamMember) -> bool:
        """Reemplaza un miembro existente. Devuelve ``False`` si no existía."""

    @abstractmethod
    def delete(self, member_id: UUID) -> bool:
        """Borra un miembro. Devuelve ``False`` si no existía."""
