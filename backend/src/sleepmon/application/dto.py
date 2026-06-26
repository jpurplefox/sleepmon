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
    ribbon: str = ""  # vacío = sin listón


@dataclass(frozen=True, slots=True)
class Distributions:
    """Distribuciones agregadas del equipo, listas para serializar."""

    natures: dict[str, int]
    ingredients: dict[str, int]
    sub_skills: dict[str, int]
    nature_stats: dict[str, int]


@dataclass(frozen=True, slots=True)
class ProductionInput:
    """Datos crudos para estimar la producción de un Pokémon (no se persiste)."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza (sin efecto)
    sub_skills: list[str] = field(default_factory=list)
    ribbon: str = ""  # vacío = sin listón


@dataclass(frozen=True, slots=True)
class SlotAmount:
    """Producción diaria de un slot de ingrediente, lista para serializar."""

    ingredient: str
    amount: float


@dataclass(frozen=True, slots=True)
class ProductionResult:
    """Producción estimada de un Pokémon en un día."""

    helps_per_day: float
    seconds_per_help: int
    berry: str
    berry_amount: float
    berry_percentage: float
    ingredient_percentage: float
    skill_percentage: float
    effective_skill_percentage: float
    ingredients: list[SlotAmount]
    skill_triggers: float
    night_skill_chances: list[float]
    inventory: int
    inventory_fill_hours: float
