"""Cálculo de producción diaria de un Pokémon (puro, sin infraestructura).

Estima cuánto produce un Pokémon en un día a partir de los datos de su especie
(frecuencia de ayuda base, % de ingrediente/skill, cantidades por slot/ingrediente,
inventario base), los ingredientes elegidos y el nivel. Siempre asume el bonus de
energía máxima.

Modelo:
- La naturaleza y las sub skills modifican frecuencia, % de ingrediente, % de skill,
  bayas por ayuda (Berry Finding) e inventario (Inventory Up). Energy/EXP se ignoran.
- El nivel define qué slots de ingrediente están desbloqueados (las ayudas de
  ingrediente se reparten entre ellos) y baja la frecuencia (-0.2%/nivel).
- Inventario: de día (``DAY_HOURS``) nunca se llena. De noche (``NIGHT_HOURS``) no
  se vacía: una vez que el inventario base se llena, el resto de la noche TODAS las
  ayudas pasan a producir bayas (no ingredientes ni skills). El inventario cuenta la
  cantidad real producida (bayas + ingredientes; las skills no ocupan inventario).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from sleepmon.domain.catalog_data import (
    DAY_HOURS,
    FREQUENCY_REDUCTION_PER_LEVEL,
    MAX_ENERGY_BONUS,
    MAX_INGREDIENTS,
    NATURE_EFFECTS,
    NIGHT_HOURS,
    SKILL_PITY_HELPS,
    SUB_SKILL_UNLOCK_LEVELS,
    max_ingredient_slots,
)
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Berry, Ingredient, Nature, NatureStat, Specialty, SubSkill

_BERRY_PER_HELP_SPECIALTY = 2
_BERRY_PER_HELP_OTHER = 1
_SECONDS_PER_HOUR = 3600

# Efectos de sub skills sobre la producción (magnitudes de RaenonX).
_SPEED_SUBSKILLS = {
    SubSkill.HELPING_SPEED_M: 0.14,
    SubSkill.HELPING_SPEED_S: 0.07,
    SubSkill.HELPING_BONUS: 0.05,  # comparador: solo cuenta para sí mismo, no ×equipo
}
_INGREDIENT_SUBSKILLS = {
    SubSkill.INGREDIENT_FINDER_M: 0.36,
    SubSkill.INGREDIENT_FINDER_S: 0.18,
}
_SKILL_SUBSKILLS = {
    SubSkill.SKILL_TRIGGER_M: 0.36,
    SubSkill.SKILL_TRIGGER_S: 0.18,
}
_INVENTORY_SUBSKILLS = {
    SubSkill.INVENTORY_UP_S: 6,
    SubSkill.INVENTORY_UP_M: 12,
    SubSkill.INVENTORY_UP_L: 18,
}
_BERRY_FINDING_S_BONUS = 1  # +1 baya por ayuda de baya

# Factores MULTIPLICATIVOS de naturaleza por stat (sube, baja). La naturaleza NO se
# suma con las sub skills: se compone (multiplica) por encima. Energy/EXP se ignoran.
# Para velocidad, <1 = ayuda más rápido (intervalo menor).
_NATURE_SPEED = (0.90, 1.075)  # sube speed -> freq ×0.90 ; baja -> ×1.075
_NATURE_INGREDIENT = (1.20, 0.80)
_NATURE_SKILL = (1.20, 0.80)


def _nature_factor(nature: Nature | None, stat: NatureStat, up: float, down: float) -> float:
    """Factor multiplicativo de la naturaleza para un stat (1.0 = sin efecto).

    ``None`` = sin naturaleza.
    """
    if nature is None:
        return 1.0
    effect = NATURE_EFFECTS[nature]
    if effect.increased is stat:
        return up
    if effect.decreased is stat:
        return down
    return 1.0


def _effective_skill_rate(base_rate: float) -> float:
    """Tasa efectiva de skill considerando el pity proc (activación garantizada a
    las ``SKILL_PITY_HELPS`` ayudas). Es ``1 / E`` con ``E`` el promedio de ayudas
    por activación de una geométrica truncada: ``E = (1 - (1-p)^N) / p``."""
    if base_rate <= 0:
        return 0.0
    return base_rate / (1 - (1 - base_rate) ** SKILL_PITY_HELPS)


def _skill_chances(lam: float, cap: int) -> tuple[float, ...]:
    """Probabilidades ``P(N >= k)`` para ``k = 1..cap`` con ``N ~ Poisson(lam)``.

    Son las chances de disparar la skill "al menos k veces" hasta el tope. La suma
    es ``E[min(N, cap)]`` (las activaciones esperadas con tope).
    """
    chances: list[float] = []
    cdf_below = 0.0  # P(N <= k-1)
    pmf = math.exp(-lam)  # arranca en P(N=0)
    for k in range(1, cap + 1):
        cdf_below += pmf
        chances.append(max(0.0, 1 - cdf_below))  # P(N >= k)
        pmf = pmf * lam / k
    return tuple(chances)


@dataclass(frozen=True, slots=True)
class SlotProduction:
    """Producción diaria de un slot de ingrediente desbloqueado."""

    ingredient: Ingredient
    amount: float


@dataclass(frozen=True, slots=True)
class DailyProduction:
    """Producción estimada de un Pokémon en un día."""

    helps_per_day: float
    seconds_per_help: int  # intervalo entre ayudas (ya truncado a segundos enteros)
    berry: Berry
    berry_amount: float
    berry_percentage: float
    ingredient_percentage: float
    skill_percentage: float  # tasa base de la especie
    effective_skill_percentage: float  # tasa efectiva con pity proc
    ingredients: tuple[SlotProduction, ...]
    skill_triggers: float
    # Chances de disparar la skill de noche al menos k veces (k=1..tope).
    night_skill_chances: tuple[float, ...]
    inventory: int  # inventario efectivo (base + Inventory Up)
    inventory_fill_hours: float


def _berry_per_help(specialty: Specialty) -> int:
    return _BERRY_PER_HELP_SPECIALTY if specialty is Specialty.BERRIES else _BERRY_PER_HELP_OTHER


def daily_production(
    species: Species,
    ingredients: tuple[Ingredient, ...],
    level: int,
    nature: Nature | None = None,
    sub_skills: tuple[SubSkill, ...] = (),
) -> DailyProduction:
    """Estima la producción diaria con ingredientes, nivel, naturaleza y sub skills.

    ``ingredients`` debe tener un ingrediente por slot (``MAX_INGREDIENTS``); la
    validación vive en la capa de aplicación. Por defecto, sin naturaleza (``None``)
    ni sub skills (sin modificadores).
    """
    if len(ingredients) != MAX_INGREDIENTS:
        raise ValueError(
            f"Se esperaban {MAX_INGREDIENTS} ingredientes; llegaron {len(ingredients)}."
        )

    # Solo cuentan las sub skills DESBLOQUEADAS al nivel (cada slot abre a 10/25/50/
    # 70/80); las que el nivel todavía no activó se ignoran.
    active = tuple(
        s
        for i, s in enumerate(sub_skills)
        if i < len(SUB_SKILL_UNLOCK_LEVELS) and level >= SUB_SKILL_UNLOCK_LEVELS[i]
    )

    # Las sub skills SUMAN entre sí; la naturaleza se COMPONE (multiplica) por encima.
    speed_ss = sum(_SPEED_SUBSKILLS.get(s, 0.0) for s in active)
    ingredient_ss = sum(_INGREDIENT_SUBSKILLS.get(s, 0.0) for s in active)
    skill_ss = sum(_SKILL_SUBSKILLS.get(s, 0.0) for s in active)
    inventory_bonus = sum(_INVENTORY_SUBSKILLS.get(s, 0) for s in active)
    berry_finding = _BERRY_FINDING_S_BONUS if SubSkill.BERRY_FINDING_S in active else 0

    # Frecuencia: baja con el nivel (-0.2%/nivel), con las sub skills de velocidad
    # ((1 − Σ)) y con la naturaleza (factor compuesto). El intervalo (ya con el bonus
    # de energía) se trunca a segundos enteros —"cada mm:ss"— y de ahí salen las ayudas.
    level_factor = 1 - FREQUENCY_REDUCTION_PER_LEVEL * (level - 1)
    speed_factor = max(
        0.05, (1 - speed_ss) * _nature_factor(nature, NatureStat.SPEED_OF_HELP, *_NATURE_SPEED)
    )
    seconds_per_help = math.floor(
        species.help_frequency_seconds * level_factor * speed_factor / MAX_ENERGY_BONUS
    )
    helps_per_second = 1 / seconds_per_help
    berry_per_help = _berry_per_help(species.specialty) + berry_finding

    # % de ingrediente y skill efectivos: base × (1 + Σ sub skills) × factor naturaleza.
    # La baya es el resto; el skill efectivo además pasa por el pity proc (independiente).
    ingredient_rate = max(
        0.0,
        species.ingredient_percentage
        / 100
        * (1 + ingredient_ss)
        * _nature_factor(nature, NatureStat.INGREDIENT_FINDING, *_NATURE_INGREDIENT),
    )
    berry_rate = max(0.0, 1 - ingredient_rate)
    effective_skill_rate = _effective_skill_rate(
        max(
            0.0,
            species.skill_percentage
            / 100
            * (1 + skill_ss)
            * _nature_factor(nature, NatureStat.MAIN_SKILL_CHANCE, *_NATURE_SKILL),
        )
    )

    inventory = species.base_inventory + inventory_bonus

    # Cantidades por slot desbloqueado (según el ingrediente elegido en cada uno).
    unlocked = max_ingredient_slots(level)
    slot_amounts = [species.ingredient_amount(i, ingredients[i]) for i in range(unlocked)]
    avg_amount = sum(slot_amounts) / unlocked if unlocked else 0.0

    # Ítems que ocupan inventario por ayuda (bayas + ingredientes; skills no).
    items_per_help = berry_rate * berry_per_help + ingredient_rate * avg_amount

    night_seconds = NIGHT_HOURS * _SECONDS_PER_HOUR
    day_seconds = DAY_HOURS * _SECONDS_PER_HOUR
    # Una ayuda da varios ítems, así que la última puede pasarse del tope: contamos
    # cuántas ayudas COMPLETAS hacen falta para llenar el inventario (redondeo hacia
    # arriba) y de ahí derivamos el tiempo.
    if items_per_help > 0:
        fill_helps = math.ceil(inventory / items_per_help)
        fill_seconds = fill_helps / helps_per_second
    else:
        fill_seconds = night_seconds
    night_normal = min(night_seconds, fill_seconds)
    night_overflow = max(0.0, night_seconds - fill_seconds)

    day_helps = day_seconds * helps_per_second
    night_normal_helps = night_normal * helps_per_second
    overflow_helps = night_overflow * helps_per_second
    normal_helps = day_helps + night_normal_helps

    # Skill independiente: una ayuda da baya/ingrediente y, además, puede disparar la
    # skill. De día sin tope; de noche, tope de activaciones (2 si la especie es de
    # skill, si no 1). El tope no afecta a las bayas (la ayuda ya produjo la suya).
    night_skill_cap = 2 if species.specialty is Specialty.SKILLS else 1
    night_skill_raw = night_normal_helps * effective_skill_rate
    night_skill_chances = _skill_chances(night_skill_raw, night_skill_cap)
    night_skill = sum(night_skill_chances)  # E[min(N, cap)]
    skill_triggers = day_helps * effective_skill_rate + night_skill

    # En el overflow nocturno TODAS las ayudas producen bayas.
    berry_amount = (normal_helps * berry_rate + overflow_helps) * berry_per_help

    helps_per_slot = normal_helps * ingredient_rate / unlocked if unlocked else 0.0
    slots = tuple(
        SlotProduction(ingredient=ingredients[i], amount=helps_per_slot * slot_amounts[i])
        for i in range(unlocked)
    )

    return DailyProduction(
        helps_per_day=(day_seconds + night_seconds) * helps_per_second,
        seconds_per_help=seconds_per_help,
        berry=species.berry,
        berry_amount=berry_amount,
        berry_percentage=berry_rate * 100,
        ingredient_percentage=ingredient_rate * 100,
        skill_percentage=species.skill_percentage,
        effective_skill_percentage=effective_skill_rate * 100,
        ingredients=slots,
        skill_triggers=skill_triggers,
        night_skill_chances=night_skill_chances,
        inventory=inventory,
        inventory_fill_hours=fill_seconds / _SECONDS_PER_HOUR,
    )
