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

import dataclasses
import math
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final

from sleepmon.domain.catalog_data import (
    DAY_HOURS,
    FREQUENCY_REDUCTION_PER_LEVEL,
    GOOD_CAMP_TICKET_INVENTORY_FACTOR,
    GOOD_CAMP_TICKET_SPEED_FACTOR,
    MAX_ENERGY_BONUS,
    MAX_INGREDIENTS,
    MAX_LEVEL,
    NATURE_EFFECTS,
    NIGHT_HOURS,
    SUB_SKILL_UNLOCK_LEVELS,
    berry_strength_for_level,
    max_ingredient_slots,
    ribbon_inventory_bonus,
    ribbon_speed_bonus,
)
from sleepmon.domain.event_bonus import NO_EVENT, EventBonus
from sleepmon.domain.map_bonuses import MapBonuses, berry_effects
from sleepmon.domain.skills import (
    NO_TEAM_CONTEXT,
    TeamContext,
    assists_cooking,
    berry_burst_amounts,
    berry_burst_triggers,
    boosts_tasty_chance,
    charge_energy_amount,
    charges_self_energy,
    cheers_random_energy,
    cooking_assist_ingredients,
    cooking_assist_tasty_chance,
    cooking_minus_energy_amount,
    cooking_minus_pot_amount,
    cooking_power_up_amount,
    draws_ingredients,
    dream_shard_amount,
    energizing_cheer_amount,
    energy_for_everyone_amount,
    help_grant,
    ingredient_draw_amount,
    ingredient_draw_pool,
    ingredient_magnet_amount,
    is_cooking_minus,
    is_magnet_plus,
    magnet_plus_base_amount,
    magnet_plus_bonus_amount,
    magnet_plus_bonus_ingredient,
    magnets_ingredients,
    max_skill_level,
    moonlight_shared_energy,
    powers_up_cooking,
    restores_team_energy,
    skill_strength_amount,
    tasty_chance_amount,
)
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import (
    Berry,
    Ingredient,
    Nature,
    NatureStat,
    Ribbon,
    Specialty,
    SubSkill,
)

_BERRY_PER_HELP_SPECIALTY: Final[int] = 2
_BERRY_PER_HELP_OTHER: Final[int] = 1
_SECONDS_PER_HOUR: Final[int] = 3600
# Neutral map (no favorites, no expert mode): the Box/Comparison default.
# A singleton sidesteps ruff's B008 (no function calls in default arguments) —
# safe since it's frozen.
_NO_MAP: Final[MapBonuses] = MapBonuses()

# Efectos de sub skills sobre la producción (magnitudes de RaenonX).
_SPEED_SUBSKILLS: Final[Mapping[SubSkill, float]] = {
    SubSkill.HELPING_SPEED_M: 0.14,
    SubSkill.HELPING_SPEED_S: 0.07,
    SubSkill.HELPING_BONUS: 0.05,  # comparador: solo cuenta para sí mismo, no ×equipo
}
_INGREDIENT_SUBSKILLS: Final[Mapping[SubSkill, float]] = {
    SubSkill.INGREDIENT_FINDER_M: 0.36,
    SubSkill.INGREDIENT_FINDER_S: 0.18,
}
_SKILL_SUBSKILLS: Final[Mapping[SubSkill, float]] = {
    SubSkill.SKILL_TRIGGER_M: 0.36,
    SubSkill.SKILL_TRIGGER_S: 0.18,
}
_INVENTORY_SUBSKILLS: Final[Mapping[SubSkill, int]] = {
    SubSkill.INVENTORY_UP_S: 6,
    SubSkill.INVENTORY_UP_M: 12,
    SubSkill.INVENTORY_UP_L: 18,
}
_BERRY_FINDING_S_BONUS: Final[int] = 1  # +1 baya por ayuda de baya

# Factores MULTIPLICATIVOS de naturaleza por stat (sube, baja). La naturaleza NO se
# suma con las sub skills: se compone (multiplica) por encima. Energy/EXP se ignoran.
# Para velocidad, <1 = ayuda más rápido (intervalo menor).
_NATURE_SPEED: Final[tuple[float, float]] = (0.90, 1.075)  # sube speed -> ×0.90 ; baja -> ×1.075
_NATURE_INGREDIENT: Final[tuple[float, float]] = (1.20, 0.80)
_NATURE_SKILL: Final[tuple[float, float]] = (1.20, 0.80)


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


def _effective_skill_rate(base_rate: float, pity_helps: int) -> float:
    """Tasa efectiva de skill considerando el pity proc (activación garantizada a las
    ``pity_helps`` ayudas, propio de la especie). Es ``1 / E`` con ``E`` el promedio de
    ayudas por activación de una geométrica truncada: ``E = (1 - (1-p)^N) / p``."""
    if base_rate <= 0:
        return 0.0
    return base_rate / (1 - (1 - base_rate) ** pity_helps)


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
class BerryYield:
    """Berries of one type per day and their strength (map multiplier in, area bonus out)."""

    berry: Berry
    amount: float
    strength: float


@dataclass(frozen=True, slots=True)
class HelpYield:
    """What one normal help brings on average (for helps granted by a teammate's skill)."""

    berries: float
    berry_strength: float  # map multiplier in, area bonus out
    ingredients: tuple[SlotProduction, ...]  # per open slot


NO_HELP_YIELD = HelpYield(0.0, 0.0, ())


@dataclass(frozen=True, slots=True)
class HelpGrant:
    """Helps per day a skill grants each target, and how many members each trigger hits."""

    per_target: float
    targets: int  # 1, 2, or WHOLE_TEAM


@dataclass(frozen=True, slots=True)
class DailyProduction:
    """Producción estimada de un Pokémon en un día."""

    helps_per_day: float
    seconds_per_help: int  # intervalo entre ayudas (ya truncado a segundos enteros)
    berry: Berry
    berry_amount: float
    # Daily direct berry strength to Snorlax (main skill excluded): ``berry_amount``
    # x the berry's strength at this level. Already includes the favorite-berry
    # multiplier (x2 / x2.4); does NOT include the Area Bonus.
    berry_strength: float
    berry_percentage: float
    ingredient_percentage: float
    skill_percentage: float  # tasa base de la especie
    effective_skill_percentage: float  # tasa efectiva con pity proc
    ingredients: tuple[SlotProduction, ...]
    skill_triggers: float
    # Skill level actually used: the member's level plus the main berry's +1,
    # capped at the skill's real max. The UI compares it to the member's own level.
    effective_skill_level: int
    # Ingredientes/día que aporta la main skill (p. ej. Ingredient Draw S), uno por
    # ingrediente del pool. Vacío si la skill de la especie no produce ingredientes.
    skill_ingredients: tuple[SlotProduction, ...]
    # Energía/día que la main skill restaura a CADA compañero del equipo (p. ej.
    # Energy for Everyone S). ``None`` si la skill no restaura energía al equipo.
    skill_energy: float | None
    # Ingredientes/día (de cualquier tipo, al azar) que consigue la main skill (p.
    # ej. Ingredient Magnet S), como total sin desglosar. ``None`` si la skill no
    # consigue ingredientes al azar.
    skill_ingredient_total: float | None
    # Ingredientes extra de pote/día que aporta la main skill (Cooking Power-Up S):
    # cuántos slots extra de pote suma en total en el día. ``None`` si no aplica.
    skill_cooking_ingredients: float | None
    # Fuerza/día que la main skill suma a Snorlax (Charge Strength S / M). Para los
    # montos aleatorios (S Random) es el valor esperado (punto medio). ``None`` si la
    # skill no suma fuerza modelada (p. ej. la variante Stockpile).
    skill_strength: float | None
    # Energía/día que la main skill restaura al PROPIO Pokémon (Charge Energy S).
    # ``None`` si la skill de la especie no carga energía al usuario.
    skill_self_energy: float | None
    # Fragmentos de sueño/día que consigue la main skill (Dream Shard Magnet S). Para
    # los montos aleatorios es el valor esperado (punto medio). ``None`` si no aplica.
    skill_dream_shards: float | None
    # Aumento de Extra Tasty (en %) acumulado por la main skill (Tasty Chance S):
    # disparos × %_del_nivel, sin acotar al tope de stack del juego. ``None`` si no aplica.
    skill_tasty_chance: float | None
    # Helps per day the skill grants EACH target (Extra Helpful S, Helper Boost, Heal
    # Pulse): disparos × ×N_del_nivel. ``None`` si la skill no da ayudas.
    skill_extra_helpful: float | None
    # Energía/día que la main skill reparte al equipo, a un compañero al azar cada
    # disparo (Energizing Cheer S): disparos × cantidad_del_nivel. ``None`` si no aplica.
    skill_random_energy: float | None
    # Chances de disparar la skill de noche al menos k veces (k=1..tope).
    night_skill_chances: tuple[float, ...]
    inventory: int  # inventario efectivo (base + Inventory Up)
    inventory_fill_hours: float
    # Berry Burst: own berries from the skill (a subset of berry_amount/berry_strength).
    skill_berry_amount: float | None = None
    skill_berry_strength: float | None = None
    # Berry Burst: berries of EACH teammate per day (a count; no team, no strength).
    skill_berries_per_teammate: float | None = None
    # Berry Burst: berries obtained from teammates, filled by the team pass only.
    teammate_berries: tuple[BerryYield, ...] = ()
    # Ingredients a skill got from teammates (Extra Helpful), filled by the team pass.
    teammate_ingredients: tuple[SlotProduction, ...] = ()
    # One normal help's yield (intensive: not scaled by weight).
    help_yield: HelpYield = NO_HELP_YIELD
    # Helps the skill grants team members (Extra Helpful, Helper Boost, Heal Pulse).
    help_grant: HelpGrant | None = None


def scale_daily(daily: DailyProduction, weight: float) -> DailyProduction:
    """Scales daily production by ``weight`` (fraction of the slot's time).

    Only scales *extensive* magnitudes (amounts/day, strength/day and
    ``helps_per_day``): berries, ingredients, triggers and main skill outputs.
    The *intensive* ones (percentages, ``seconds_per_help``, ``night_skill_chances``,
    ``inventory``, ``inventory_fill_hours``, ``effective_skill_level``) are left
    unchanged: they describe the Pokémon's pace, not its contribution to the team.
    ``weight == 1.0`` returns something equivalent to the original (identity).
    """
    if weight == 1.0:
        return daily

    def _s(value: float | None) -> float | None:
        return None if value is None else value * weight

    return dataclasses.replace(
        daily,
        helps_per_day=daily.helps_per_day * weight,
        berry_amount=daily.berry_amount * weight,
        berry_strength=daily.berry_strength * weight,
        ingredients=tuple(
            SlotProduction(sp.ingredient, sp.amount * weight) for sp in daily.ingredients
        ),
        skill_triggers=daily.skill_triggers * weight,
        skill_ingredients=tuple(
            SlotProduction(sp.ingredient, sp.amount * weight)
            for sp in daily.skill_ingredients
        ),
        skill_energy=_s(daily.skill_energy),
        skill_ingredient_total=_s(daily.skill_ingredient_total),
        skill_cooking_ingredients=_s(daily.skill_cooking_ingredients),
        skill_strength=_s(daily.skill_strength),
        skill_self_energy=_s(daily.skill_self_energy),
        skill_dream_shards=_s(daily.skill_dream_shards),
        skill_tasty_chance=_s(daily.skill_tasty_chance),
        skill_extra_helpful=_s(daily.skill_extra_helpful),
        skill_random_energy=_s(daily.skill_random_energy),
        skill_berry_amount=_s(daily.skill_berry_amount),
        skill_berry_strength=_s(daily.skill_berry_strength),
        skill_berries_per_teammate=_s(daily.skill_berries_per_teammate),
        teammate_berries=tuple(
            BerryYield(y.berry, y.amount * weight, y.strength * weight)
            for y in daily.teammate_berries
        ),
        teammate_ingredients=tuple(
            SlotProduction(sp.ingredient, sp.amount * weight) for sp in daily.teammate_ingredients
        ),
        help_grant=(
            None
            if daily.help_grant is None
            else HelpGrant(daily.help_grant.per_target * weight, daily.help_grant.targets)
        ),
    )


def _berry_per_help(specialty: Specialty) -> int:
    return _BERRY_PER_HELP_SPECIALTY if specialty is Specialty.BERRIES else _BERRY_PER_HELP_OTHER


def daily_production(
    species: Species,
    ingredients: tuple[Ingredient, ...],
    level: int,
    nature: Nature | None = None,
    sub_skills: tuple[SubSkill, ...] = (),
    ribbon: Ribbon = Ribbon.NONE,
    skill_level: int = 1,
    map_bonuses: MapBonuses = _NO_MAP,
    good_camp_ticket: bool = False,
    event: EventBonus = NO_EVENT,
    team_context: TeamContext = NO_TEAM_CONTEXT,
) -> DailyProduction:
    """Estimates daily production from ingredients, level, nature and sub skills.

    ``ingredients`` must have one ingredient per slot (``MAX_INGREDIENTS``);
    validation lives in the application layer. Defaults to no nature (``None``)
    and no sub skills (no modifiers). ``skill_level`` (1..MAX_SKILL_LEVEL) defines
    how many ingredients each trigger of Ingredient Draw S-type skills delivers.
    ``map_bonuses`` (neutral by default) brings the expert-mode effects; the skill
    level actually used is reported in ``effective_skill_level``. ``event`` (neutral by
    default) brings a hand-built event's per-member boosts. ``team_context`` is the
    team context Draco Meteor reads (the floor by default).
    """
    if len(ingredients) != MAX_INGREDIENTS:
        raise ValueError(
            f"Se esperaban {MAX_INGREDIENTS} ingredientes; llegaron {len(ingredients)}."
        )
    # Función de dominio reusable: reguarda el rango de nivel por su cuenta (igual que
    # el conteo de ingredientes), para no rendir un cálculo silenciosamente erróneo si
    # se la invoca sin pasar antes por validate_level. level<=0 dispararía level_factor>1
    # y max_ingredient_slots(0)=0.
    if not 1 <= level <= MAX_LEVEL:
        raise ValueError(f"El nivel debe estar entre 1 y {MAX_LEVEL}; llegó {level}.")

    # Expert-mode effects for this member's berry, and the skill level they actually
    # use (capped at the skill's real max — a maxed-out member gains nothing).
    effects = berry_effects(map_bonuses, species.berry)
    boosts = event.boosts_for(species)
    effective_skill_level = min(
        skill_level + effects.skill_level_bonus + boosts.skill_level_bonus,
        max_skill_level(species.main_skill),
    )

    # Solo cuentan las sub skills DESBLOQUEADAS al nivel (cada slot abre a 10/25/50/
    # 70/80); las que el nivel todavía no activó se ignoran.
    active = tuple(
        s
        for i, s in enumerate(sub_skills)
        if i < len(SUB_SKILL_UNLOCK_LEVELS) and level >= SUB_SKILL_UNLOCK_LEVELS[i]
    )

    # Las sub skills de velocidad SUMAN entre sí; la naturaleza y el listón se COMPONEN
    # (multiplican) por encima, cada uno como un factor aparte (no se suman con las sub
    # skills). El listón solo da velocidad si al Pokémon le quedan evoluciones (las
    # formas finales no reciben), y a las 500h/2000h.
    speed_ss = sum(_SPEED_SUBSKILLS.get(s, 0.0) for s in active)
    ribbon_factor = 1 - ribbon_speed_bonus(ribbon, species.evolutions_remaining)
    ingredient_ss = sum(_INGREDIENT_SUBSKILLS.get(s, 0.0) for s in active)
    skill_ss = sum(_SKILL_SUBSKILLS.get(s, 0.0) for s in active)
    inventory_bonus = sum(_INVENTORY_SUBSKILLS.get(s, 0) for s in active)
    berry_finding = _BERRY_FINDING_S_BONUS if SubSkill.BERRY_FINDING_S in active else 0

    # Frecuencia: baja con el nivel (-0.2%/nivel), con las sub skills de velocidad
    # ((1 − Σ)), con la naturaleza (factor compuesto) y con el listón (otro factor
    # compuesto). El intervalo (ya con el bonus de energía) se trunca a segundos
    # enteros —"cada mm:ss"— y de ahí salen las ayudas.
    level_factor = 1 - FREQUENCY_REDUCTION_PER_LEVEL * (level - 1)
    speed_factor = max(
        0.05,
        (1 - speed_ss)
        * ribbon_factor
        * _nature_factor(nature, NatureStat.SPEED_OF_HELP, *_NATURE_SPEED),
    )
    camp_speed = GOOD_CAMP_TICKET_SPEED_FACTOR if good_camp_ticket else 1.0
    seconds_per_help = math.floor(
        species.help_frequency_seconds
        * level_factor
        * speed_factor
        * camp_speed
        * effects.speed_factor
        / MAX_ENERGY_BONUS
    )
    helps_per_second = 1 / seconds_per_help
    berry_per_help = _berry_per_help(species.specialty) + berry_finding + boosts.extra_berries

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
    # Stacked factors are unbounded; the per-help rate is a probability, so clamp to [0, 1].
    effective_skill_rate = _effective_skill_rate(
        min(
            1.0,
            max(
                0.0,
                species.skill_percentage
                / 100
                * (1 + skill_ss)
                * _nature_factor(nature, NatureStat.MAIN_SKILL_CHANCE, *_NATURE_SKILL)
                * effects.skill_rate_factor
                * boosts.skill_rate_factor,
            ),
        ),
        species.pity_helps,
    )

    camp_inventory = GOOD_CAMP_TICKET_INVENTORY_FACTOR if good_camp_ticket else 1.0
    inventory = round(
        (
            species.carry_limit
            + inventory_bonus
            + ribbon_inventory_bonus(ribbon)
            + boosts.carry_limit_bonus
        )
        * camp_inventory
    )

    # Cantidades por slot desbloqueado (según el ingrediente elegido en cada uno). El
    # primer slot abre a nivel 1, así que con el rango de nivel ya validado unlocked >= 1.
    unlocked = max_ingredient_slots(level)
    slot_amounts = [species.ingredient_amount(i, ingredients[i]) for i in range(unlocked)]
    extra_ingredients = effects.extra_ingredients + boosts.extra_ingredients
    avg_amount = sum(slot_amounts) / unlocked + extra_ingredients

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

    # Ingredientes por la main skill (Ingredient Draw S y variantes): cada disparo
    # entrega ``ingredient_draw_amount(...)`` ingredientes (esperados) repartidos en
    # partes iguales entre el pool de la skill. Es independiente de la mecánica
    # normal de ingredientes y no ocupa inventario en este modelo.
    skill_ingredients: tuple[SlotProduction, ...] = ()
    if draws_ingredients(species):
        pool = ingredient_draw_pool(species)
        if pool:
            per_ingredient = (
                skill_triggers
                * ingredient_draw_amount(species.main_skill, effective_skill_level)
                / len(pool)
            )
            skill_ingredients = tuple(
                SlotProduction(ingredient=ing, amount=per_ingredient) for ing in pool
            )

    # Energía por la main skill (Energy for Everyone S): cada disparo restaura
    # ``energy_for_everyone_amount(...)`` de energía a CADA compañero, así que por día
    # y por compañero es disparos × esa cantidad.
    skill_energy: float | None = None
    if restores_team_energy(species):
        skill_energy = skill_triggers * energy_for_everyone_amount(
            species.main_skill, effective_skill_level
        )

    # Ingredientes al azar por la main skill (Ingredient Magnet S): solo el total,
    # sin desglosar por tipo (el tipo es impredecible). La variante (Plus) de Plusle
    # usa su propia tabla base para el total al azar, y además da un ingrediente FIJO
    # (café/leche) como bonus de sinergia: ese sí es específico, así que va junto a los
    # ``skill_ingredients`` (se muestra en la sección Ingredientes, no en Skill).
    skill_ingredient_total: float | None = None
    if is_magnet_plus(species):
        skill_ingredient_total = skill_triggers * magnet_plus_base_amount(effective_skill_level)
        bonus_ingredient = magnet_plus_bonus_ingredient(species)
        if bonus_ingredient is not None:
            skill_ingredients = (
                SlotProduction(
                    ingredient=bonus_ingredient,
                    amount=skill_triggers * magnet_plus_bonus_amount(effective_skill_level),
                ),
            )
    elif magnets_ingredients(species):
        skill_ingredient_total = skill_triggers * ingredient_magnet_amount(
            species.main_skill, effective_skill_level
        )
    elif assists_cooking(species):
        skill_ingredient_total = skill_triggers * cooking_assist_ingredients(effective_skill_level)

    # Event: ingredients gathered by main skills are multiplied.
    skill_ing_factor = boosts.skill_ingredient_factor
    if skill_ing_factor != 1.0:
        skill_ingredients = tuple(
            SlotProduction(sp.ingredient, sp.amount * skill_ing_factor) for sp in skill_ingredients
        )
        if skill_ingredient_total is not None:
            skill_ingredient_total *= skill_ing_factor

    # Ingredientes extra de pote por la main skill (Cooking Power-Up S): cada disparo
    # agranda el pote en N slots, así que por día es disparos × N. La variante (Minus)
    # de Minun usa su propia tabla base de pote (más chica que la regular).
    skill_cooking_ingredients: float | None = None
    if is_cooking_minus(species):
        skill_cooking_ingredients = skill_triggers * cooking_minus_pot_amount(effective_skill_level)
    elif powers_up_cooking(species):
        skill_cooking_ingredients = skill_triggers * cooking_power_up_amount(effective_skill_level)

    # Fuerza por la main skill (Charge Strength, Aura Sphere, Psystrike): cada disparo
    # suma la fuerza esperada del nivel, así que por día es disparos × esa fuerza.
    # ``None`` si la skill no suma fuerza.
    per_strength = skill_strength_amount(species.main_skill, effective_skill_level)
    skill_strength: float | None = (
        skill_triggers * per_strength if per_strength is not None else None
    )

    # Energía al propio Pokémon por la main skill (Charge Energy S): disparos × la
    # energía del nivel.
    skill_self_energy: float | None = None
    if charges_self_energy(species):
        skill_self_energy = skill_triggers * charge_energy_amount(effective_skill_level)

    # Fragmentos de sueño por la main skill (Dream Shard Magnet S, and Super Luck's
    # occasional hauls): disparos × la cantidad esperada del nivel.
    per_shards = dream_shard_amount(species.main_skill, effective_skill_level)
    skill_dream_shards: float | None = (
        skill_triggers * per_shards if per_shards is not None else None
    )

    # Aumento de Extra Tasty por la main skill (Tasty Chance S): el boost se ACUMULA
    # con cada disparo (disparos × %_del_nivel). No lo acotamos al tope de stack del
    # juego (70%): a ese nivel un crítico lo consume y se sigue sumando. Bulk Up's
    # boost accumulates the same way.
    skill_tasty_chance: float | None = None
    per_bulk_up = cooking_assist_tasty_chance(species.main_skill, effective_skill_level)
    if boosts_tasty_chance(species):
        skill_tasty_chance = skill_triggers * tasty_chance_amount(effective_skill_level)
    elif per_bulk_up is not None:
        skill_tasty_chance = skill_triggers * per_bulk_up

    # Helps granted to team members (Extra Helpful, Helper Boost, Heal Pulse): per target
    # per day, disparos × ayudas por objetivo. The team pass turns them into production.
    grant = help_grant(species.main_skill, effective_skill_level, team_context)
    granted = None if grant is None else HelpGrant(skill_triggers * grant.helps, grant.targets)
    skill_extra_helpful = None if granted is None else granted.per_target

    # Energía a un compañero al azar: la da Energizing Cheer S, el BONUS de Cooking
    # Power-Up S (Minus) de Minun (asumiendo compañero Plus/Minus presente) y Moonlight
    # half the time. El total repartido en el día es disparos × cantidad esperada.
    skill_random_energy: float | None = None
    per_shared = moonlight_shared_energy(species.main_skill, effective_skill_level)
    if per_shared is not None:
        skill_random_energy = skill_triggers * per_shared
    elif cheers_random_energy(species):
        skill_random_energy = skill_triggers * energizing_cheer_amount(
            species.main_skill, effective_skill_level
        )
    elif is_cooking_minus(species):
        skill_random_energy = skill_triggers * cooking_minus_energy_amount(effective_skill_level)

    # En el overflow nocturno TODAS las ayudas producen bayas.
    helps_berry_amount = (normal_helps * berry_rate + overflow_helps) * berry_per_help

    # Fuerza directa de las bayas: cantidad de bayas × fuerza por baya del nivel.
    # El multiplicador (favorita normal x2, principal experta x2.4, o x1) viene del mapa.
    per_berry_strength = berry_strength_for_level(
        species.berry, level, multiplier=effects.berry_multiplier
    )

    # Berry Burst: own berries join the berry totals; teammates' are a per-teammate count.
    skill_berry_amount: float | None = None
    skill_berry_strength: float | None = None
    skill_berries_per_teammate: float | None = None
    burst = berry_burst_amounts(species.main_skill, effective_skill_level, team_context)
    if burst is not None:
        burst_triggers = berry_burst_triggers(species.main_skill, skill_triggers)
        skill_berry_amount = burst_triggers * burst.own
        skill_berry_strength = skill_berry_amount * per_berry_strength
        skill_berries_per_teammate = burst_triggers * burst.per_teammate

    berry_amount = helps_berry_amount + (skill_berry_amount or 0.0)
    berry_strength = berry_amount * per_berry_strength

    help_yield = HelpYield(
        berries=berry_rate * berry_per_help,
        berry_strength=berry_rate * berry_per_help * per_berry_strength,
        ingredients=tuple(
            SlotProduction(
                ingredients[i], ingredient_rate / unlocked * (slot_amounts[i] + extra_ingredients)
            )
            for i in range(unlocked)
        ),
    )

    helps_per_slot = normal_helps * ingredient_rate / unlocked
    slots = tuple(
        SlotProduction(
            ingredient=ingredients[i],
            amount=helps_per_slot * (slot_amounts[i] + extra_ingredients),
        )
        for i in range(unlocked)
    )

    return DailyProduction(
        helps_per_day=(day_seconds + night_seconds) * helps_per_second,
        seconds_per_help=seconds_per_help,
        berry=species.berry,
        berry_amount=berry_amount,
        berry_strength=berry_strength,
        berry_percentage=berry_rate * 100,
        ingredient_percentage=ingredient_rate * 100,
        skill_percentage=species.skill_percentage,
        effective_skill_percentage=effective_skill_rate * 100,
        ingredients=slots,
        skill_triggers=skill_triggers,
        effective_skill_level=effective_skill_level,
        skill_ingredients=skill_ingredients,
        skill_energy=skill_energy,
        skill_ingredient_total=skill_ingredient_total,
        skill_cooking_ingredients=skill_cooking_ingredients,
        skill_strength=skill_strength,
        skill_self_energy=skill_self_energy,
        skill_dream_shards=skill_dream_shards,
        skill_tasty_chance=skill_tasty_chance,
        skill_extra_helpful=skill_extra_helpful,
        skill_random_energy=skill_random_energy,
        night_skill_chances=night_skill_chances,
        inventory=inventory,
        inventory_fill_hours=fill_seconds / _SECONDS_PER_HOUR,
        skill_berry_amount=skill_berry_amount,
        skill_berry_strength=skill_berry_strength,
        skill_berries_per_teammate=skill_berries_per_teammate,
        help_yield=help_yield,
        help_grant=granted,
    )
