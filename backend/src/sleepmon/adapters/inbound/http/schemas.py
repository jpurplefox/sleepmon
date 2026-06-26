"""Schemas de entrada/salida HTTP (msgspec). Desacoplan el JSON del dominio."""

from __future__ import annotations

import msgspec


class MemberIn(msgspec.Struct, forbid_unknown_fields=True):
    """Payload para crear o actualizar un miembro."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza
    sub_skills: list[str] = []


class MemberOut(msgspec.Struct):
    id: str
    species: str
    level: int
    nature: str
    ingredients: list[str]
    sub_skills: list[str]


class NatureOut(msgspec.Struct):
    name: str
    neutral: bool
    increased: str | None = None
    decreased: str | None = None


class SubSkillOut(msgspec.Struct):
    name: str
    tier: str


class SpeciesOut(msgspec.Struct):
    name: str
    dex: int
    specialty: str
    berry: str
    sleep_type: str
    main_skill: str
    ingredient_slots: list[list[str]]
    ingredient_amounts: list[list[int]]
    base_inventory: int


class CatalogOut(msgspec.Struct):
    natures: list[NatureOut]
    sub_skills: list[SubSkillOut]
    ingredients: list[str]
    species: list[SpeciesOut]


class DistributionsOut(msgspec.Struct):
    natures: dict[str, int]
    ingredients: dict[str, int]
    sub_skills: dict[str, int]
    nature_stats: dict[str, int]


class ProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    """Payload para estimar producción: especie, nivel, ingredientes, naturaleza y sub skills."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza
    sub_skills: list[str] = msgspec.field(default_factory=list)


class SlotProductionOut(msgspec.Struct):
    ingredient: str
    amount: float


class ProductionOut(msgspec.Struct):
    helps_per_day: float
    seconds_per_help: int
    berry: str
    berry_amount: float
    berry_percentage: float
    ingredient_percentage: float
    skill_percentage: float
    effective_skill_percentage: float
    ingredients: list[SlotProductionOut]
    skill_triggers: float
    night_skill_chances: list[float]
    inventory: int
    inventory_fill_hours: float


class ErrorOut(msgspec.Struct):
    detail: str
