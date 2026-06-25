"""Distribuciones agregadas del equipo: funciones puras sobre las entidades.

No tocan la base: reciben los miembros ya cargados y cuentan. Equipos chicos, así
que calcular en memoria es simple y 100% testeable.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable

from sleepmon.domain.catalog_data import NATURE_EFFECTS
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.value_objects import Ingredient, Nature, NatureStat, SubSkill


def nature_distribution(members: Iterable[TeamMember]) -> dict[Nature, int]:
    """Cuántos miembros del equipo tienen cada naturaleza."""
    counter: Counter[Nature] = Counter(member.nature for member in members)
    return dict(counter)


def ingredient_distribution(members: Iterable[TeamMember]) -> dict[Ingredient, int]:
    """Cuántas veces aparece cada ingrediente entre todos los slots del equipo."""
    counter: Counter[Ingredient] = Counter()
    for member in members:
        counter.update(member.ingredients)
    return dict(counter)


def sub_skill_distribution(members: Iterable[TeamMember]) -> dict[SubSkill, int]:
    """Cuántas veces aparece cada sub skill en el equipo."""
    counter: Counter[SubSkill] = Counter()
    for member in members:
        counter.update(member.sub_skills)
    return dict(counter)


def nature_stat_balance(members: Iterable[TeamMember]) -> dict[NatureStat, int]:
    """Balance neto por stat: +1 por cada naturaleza que lo sube, -1 por cada una
    que lo baja. Da una lectura rápida de hacia dónde está sesgado el equipo."""
    balance: dict[NatureStat, int] = {stat: 0 for stat in NatureStat}
    for member in members:
        effect = NATURE_EFFECTS[member.nature]
        if effect.increased is not None:
            balance[effect.increased] += 1
        if effect.decreased is not None:
            balance[effect.decreased] -= 1
    return balance
