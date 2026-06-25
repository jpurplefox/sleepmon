"""Excepciones del dominio. La infraestructura las traduce a códigos HTTP."""

from __future__ import annotations


class DomainError(Exception):
    """Base de todos los errores del dominio."""


class ValidationError(DomainError):
    """Datos inválidos según las reglas del dominio o del catálogo."""


class SpeciesNotFoundError(ValidationError):
    """La especie indicada no existe en el catálogo."""


class TeamMemberNotFoundError(DomainError):
    """No existe un miembro del equipo con ese id."""
