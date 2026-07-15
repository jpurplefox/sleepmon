"""Puertos secundarios (driven): interfaces que la infraestructura implementa.

El dominio y la aplicación dependen de estas abstracciones, nunca de psycopg ni de
ningún detalle de almacenamiento (DIP).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sleepmon.domain.auth import ExternalIdentity, RefreshToken, User
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


class AccessTokenService(ABC):
    """Servicio de tokens de acceso."""

    @abstractmethod
    def issue(self, user_id: UUID) -> str: ...

    @abstractmethod
    def verify(self, token: str) -> UUID: ...


class RefreshTokenCodec(ABC):
    """Codec para generar y verificar tokens de refresco."""

    @abstractmethod
    def generate(self) -> tuple[str, str]: ...

    @abstractmethod
    def hash(self, clear: str) -> str: ...


class IdentityProvider(ABC):
    """Proveedor de identidad (validación de credenciales)."""

    @abstractmethod
    def verify(self, credential: str) -> ExternalIdentity: ...


class UserRepository(ABC):
    """Persistencia de usuarios."""

    @abstractmethod
    def get_by_google_sub(self, sub: str) -> User | None: ...

    @abstractmethod
    def get(self, user_id: UUID) -> User | None: ...

    @abstractmethod
    def add(self, user: User) -> None: ...


class RefreshTokenRepository(ABC):
    """Persistencia de refresh tokens, con soporte para revocar toda una familia."""

    @abstractmethod
    def add(self, token: RefreshToken) -> None: ...

    @abstractmethod
    def find_by_hash(self, token_hash: str) -> RefreshToken | None: ...

    @abstractmethod
    def consume(self, token_id: UUID) -> None: ...

    @abstractmethod
    def delete_family(self, family_id: UUID) -> None: ...

    @abstractmethod
    def delete_expired(self, now: datetime) -> int:
        """Borra los tokens vencidos a partir de ``now``. Devuelve cuántos borró."""
