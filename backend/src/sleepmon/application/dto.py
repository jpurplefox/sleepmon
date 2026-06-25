"""Objetos de transferencia entre el borde (HTTP) y los casos de uso.

Las entradas llegan como strings (lo que manda el cliente); el service las parsea a
los enums del dominio y valida. Las salidas de distribución usan strings como claves
para serializar derecho.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class TeamMemberInput:
    """Datos crudos para crear o actualizar un miembro del equipo."""

    species: str
    level: int
    nature: str
    ingredients: list[str]
    sub_skills: list[str] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class Distributions:
    """Distribuciones agregadas del equipo, listas para serializar."""

    natures: dict[str, int]
    ingredients: dict[str, int]
    sub_skills: dict[str, int]
    nature_stats: dict[str, int]
