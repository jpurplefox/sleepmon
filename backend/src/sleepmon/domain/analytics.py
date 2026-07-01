"""Distribuciones agregadas del equipo: funciones puras sobre las entidades.

No tocan la base: reciben los miembros ya cargados y cuentan. Equipos chicos, así
que calcular en memoria es simple y 100% testeable.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass

from sleepmon.domain.catalog_data import NATURE_EFFECTS
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.production import DailyProduction
from sleepmon.domain.value_objects import Ingredient, Nature, NatureStat, SubSkill


def nature_distribution(members: Iterable[TeamMember]) -> dict[Nature, int]:
    """Cuántos miembros del equipo tienen cada naturaleza.

    Los miembros sin naturaleza (``None`` = "sin naturaleza") no se cuentan."""
    counter: Counter[Nature] = Counter(
        member.nature for member in members if member.nature is not None
    )
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
        if member.nature is None:
            continue
        effect = NATURE_EFFECTS[member.nature]
        if effect.increased is not None:
            balance[effect.increased] += 1
        if effect.decreased is not None:
            balance[effect.decreased] -= 1
    return balance


@dataclass(frozen=True, slots=True)
class SkillEffectAgg:
    """Agregado de un tipo de efecto de main skill para todo el equipo.

    ``total`` es la suma del efecto entre los miembros que lo aportan;
    ``triggers`` es la suma de sus ``skill_triggers`` (los que NO aportan este
    efecto no cuentan).
    """

    kind: str  # "strength" | "energy" | "self_energy" | "dream_shards" | ...
    total: float
    triggers: float


@dataclass(frozen=True, slots=True)
class MemberContribution:
    """Aporte de un miembro al agregado del equipo (para el desglose)."""

    member_id: str
    species: str
    strength: float  # berry_strength + skill_strength con bonus de isla
    strength_base: float  # berry_strength + skill_strength sin bonus de isla
    berry_amount: float
    ingredients_total: float
    skill_triggers: float


@dataclass(frozen=True, slots=True)
class TeamProduction:
    """Producción diaria agregada de un equipo (bayas + skills)."""

    member_count: int
    total_strength: float  # con bonus de isla
    total_berry_amount: float
    total_berry_strength: float  # con bonus de isla
    total_skill_strength: float  # con bonus de isla
    total_strength_base: float  # sin bonus de isla
    total_berry_strength_base: float  # sin bonus de isla
    total_skill_strength_base: float  # sin bonus de isla
    island_bonus: float
    ingredients: dict[Ingredient, float]
    total_ingredients: float
    skill_triggers: float
    skill_energy: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None
    skill_cooking_ingredients: float | None
    skill_ingredient_total: float | None
    skill_effects: tuple[SkillEffectAgg, ...]
    members: tuple[MemberContribution, ...]


# Métricas opcionales de la main skill que se agregan sumando los presentes (None si
# ningún miembro la aporta). Nombre del atributo en DailyProduction.
_OPTIONAL_SKILL_FIELDS: tuple[str, ...] = (
    "skill_energy",
    "skill_self_energy",
    "skill_dream_shards",
    "skill_tasty_chance",
    "skill_extra_helpful",
    "skill_random_energy",
    "skill_cooking_ingredients",
    "skill_ingredient_total",
)

# Mapeo kind → nombre del atributo en DailyProduction, en el orden canónico de
# presentación.
_EFFECT_KIND_TO_FIELD: tuple[tuple[str, str], ...] = (
    ("strength", "skill_strength"),
    ("energy", "skill_energy"),
    ("self_energy", "skill_self_energy"),
    ("dream_shards", "skill_dream_shards"),
    ("tasty_chance", "skill_tasty_chance"),
    ("extra_helpful", "skill_extra_helpful"),
    ("random_energy", "skill_random_energy"),
    ("cooking_ingredients", "skill_cooking_ingredients"),
    ("ingredient_total", "skill_ingredient_total"),
)


def _sum_optional(dailies: list[DailyProduction], field: str) -> float | None:
    """Suma los valores no-None de ``field``; None si ninguno aporta."""
    present: list[float] = [v for d in dailies if (v := getattr(d, field)) is not None]
    return sum(present) if present else None


def team_production(
    entries: Iterable[tuple[str, str, DailyProduction]],
    *,
    island_bonus: float = 0.0,
) -> TeamProduction:
    """Agrega la producción diaria de los miembros de un equipo.

    Cada entry es ``(member_id, species_name, daily)``. La fuerza total es la suma de
    la fuerza directa de bayas más la de Charge Strength (los ``None`` cuentan 0). Los
    ingredientes se agregan por tipo (slots normales + main skill).

    ``island_bonus`` escala la fuerza (bayas + skill) por el factor ``(1 + bonus)``.
    Los ingredientes y skill_effects NO se escalan: son cantidades, no fuerza.
    """
    entries_list = list(entries)
    dailies = [daily for _, _, daily in entries_list]

    factor = 1.0 + island_bonus

    ingredients: dict[Ingredient, float] = {}
    for daily in dailies:
        for slot in (*daily.ingredients, *daily.skill_ingredients):
            ingredients[slot.ingredient] = ingredients.get(slot.ingredient, 0.0) + slot.amount

    total_berry_strength_base = sum(d.berry_strength for d in dailies)
    total_skill_strength_base = sum(d.skill_strength or 0.0 for d in dailies)
    total_strength_base = total_berry_strength_base + total_skill_strength_base

    members = tuple(
        MemberContribution(
            member_id=member_id,
            species=species,
            strength=(daily.berry_strength + (daily.skill_strength or 0.0)) * factor,
            strength_base=daily.berry_strength + (daily.skill_strength or 0.0),
            berry_amount=daily.berry_amount,
            ingredients_total=sum(slot.amount for slot in daily.ingredients),
            skill_triggers=daily.skill_triggers,
        )
        for member_id, species, daily in entries_list
    )

    optional = {field: _sum_optional(dailies, field) for field in _OPTIONAL_SKILL_FIELDS}

    # Construir skill_effects: un SkillEffectAgg por cada kind que al menos un miembro
    # aporta (su atributo DailyProduction es no-None). total acumula el valor del
    # efecto; triggers acumula los skill_triggers solo de esos miembros.
    skill_effects_list: list[SkillEffectAgg] = []
    for kind, field in _EFFECT_KIND_TO_FIELD:
        total_val = 0.0
        total_trig = 0.0
        has_contributor = False
        for daily in dailies:
            value: float | None = getattr(daily, field)
            if value is not None:
                total_val += value
                total_trig += daily.skill_triggers
                has_contributor = True
        if has_contributor:
            skill_effects_list.append(
                SkillEffectAgg(kind=kind, total=total_val, triggers=total_trig)
            )

    return TeamProduction(
        member_count=len(entries_list),
        total_strength=total_strength_base * factor,
        total_berry_amount=sum(d.berry_amount for d in dailies),
        total_berry_strength=total_berry_strength_base * factor,
        total_skill_strength=total_skill_strength_base * factor,
        total_strength_base=total_strength_base,
        total_berry_strength_base=total_berry_strength_base,
        total_skill_strength_base=total_skill_strength_base,
        island_bonus=island_bonus,
        ingredients=ingredients,
        total_ingredients=sum(ingredients.values()),
        skill_triggers=sum(d.skill_triggers for d in dailies),
        skill_effects=tuple(skill_effects_list),
        members=members,
        **optional,
    )
