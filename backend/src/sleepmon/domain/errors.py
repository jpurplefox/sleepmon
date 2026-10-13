"""Excepciones del dominio. La infraestructura las traduce a códigos HTTP."""

from __future__ import annotations

from datetime import datetime


class DomainError(Exception):
    """Base de todos los errores del dominio."""


class ValidationError(DomainError):
    """Datos inválidos según las reglas del dominio o del catálogo."""


class SpeciesNotFoundError(ValidationError):
    """La especie indicada no existe en el catálogo."""


class TeamMemberNotFoundError(DomainError):
    """No existe un miembro del equipo con ese id."""


class SavedTeamNotFoundError(DomainError):
    """No saved team with that id exists for the user."""


class ComparisonShareNotFoundError(DomainError):
    """No shared comparison exists with that id."""


class HumanVerificationError(DomainError):
    """A signed-out write failed the anti-bot check (ADR 0012)."""


class HumanVerifierUnavailableError(DomainError):
    """The anti-bot provider couldn't be reached or answered garbage."""


class AnonymousSharingUnavailableError(DomainError):
    """Signed-out sharing is off: no human check is configured."""


class PokemonNotRecognizedError(DomainError):
    """The screenshots show no Pokémon species the catalog knows."""


class ScreenshotReaderUnavailableError(DomainError):
    """The model that reads screenshots couldn't be reached or failed."""


class DailyImportLimitError(DomainError):
    """The user used up today's screenshot imports."""

    def __init__(self, resets_at: datetime) -> None:
        super().__init__(f"Daily import limit reached; resets at {resets_at.isoformat()}.")
        self.resets_at = resets_at
