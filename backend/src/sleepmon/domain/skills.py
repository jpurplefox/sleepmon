"""Lógica de las main skills que producen recursos (puro, sin infraestructura).

Modela, por ahora, tres main skills:

- **Ingredient Draw S**: al dispararse entrega una cantidad fija de ingredientes
  (según el *nivel de la skill*, no el del Pokémon) repartida en partes iguales
  entre un *pool* de ingredientes. El pool es el set de ingredientes propios de la
  especie (los mismos que puede llevar en sus slots).
- **Energy for Everyone S** (E4E): al dispararse restaura una cantidad fija de
  energía a *cada* compañero del equipo (según el nivel de la skill).
- **Ingredient Magnet S**: al dispararse consigue una cantidad de ingredientes de
  *cualquier* tipo, elegidos al azar entre todos. Como el tipo es impredecible, no
  se desglosa por ingrediente: solo interesa el total que consigue.
- **Cooking Power-Up S**: al dispararse agranda el pote para la próxima comida en una
  cantidad fija de ingredientes extra (según el nivel de la skill).
- **Charge Strength S / M**: al dispararse suma fuerza a Snorlax. Hay variantes con
  monto fijo (S y M) y una variante S (Random) que da un monto aleatorio uniforme
  entre dos valores; para estimar usamos el punto medio. La variante S (Stockpile)
  accumulates; we use its average strength per trigger.
- **Charge Energy S**: al dispararse restaura una cantidad fija de energía al *propio*
  Pokémon (no al equipo), según el nivel de la skill.
- **Dream Shard Magnet S**: al dispararse consigue fragmentos de sueño. Tiene una
  variante de monto fijo y otra S (Random) con monto aleatorio uniforme entre dos
  valores (usamos el punto medio para estimar). Llega hasta nivel 8. La variante
  S (Aura Sphere) gets the base shards and also adds Strength.
- **Tasty Chance S**: al dispararse sube la probabilidad de "Extra Tasty" al cocinar
  en un porcentaje fijo (según el nivel). El boost se ACUMULA con cada disparo, así que
  se reporta ``disparos × %_del_nivel`` (sin acotar al tope de stack del juego).
- **Extra Helpful S**: al dispararse entrega instantáneamente ``×N`` la ayuda normal de
  un Pokémon (N según el nivel). Se reporta el multiplicador total del día:
  ``disparos × N``.
- **Energizing Cheer S**: al dispararse restaura energía a OTRO Pokémon del equipo
  elegido al azar (cantidad según el nivel). Se reporta el total del día que reparte
  al equipo: ``disparos × cantidad_del_nivel``.
- **Cooking Assist S** (+ Bulk Up): random ingredients like Ingredient Magnet; Bulk Up
  also raises the Extra Tasty rate (accumulated like Tasty Chance).
- **Berry Zone (Psystrike)**: only its Strength; the Berry Zone boost isn't modeled.
- **Energy for Everyone S (Lunar Blessing)**: smaller team energy, plus Berry-Burst-like
  berries that grow with the species sharing Cresselia's berry.
- **Extra Helpful S**, **Helper Boost** and **Heal Pulse**: helps granted to one, every,
  or two team members (see ``help_grant``); the team pass turns them into production.
- **Charge Energy S (Moonlight)**: also shares energy with a teammate half the time.
- **Berry Burst** (+ Disguise, Draco Meteor): own berries plus berries of each
  teammate per trigger; see ``domain/berry_burst.py`` for the team half.

La main skill se identifica por su nombre (``Species.main_skill`` es un string del
catálogo). Las variantes con pasivo extra —``Ingredient Draw S (Super Luck)``,
``Energy for Everyone S (Lunar Blessing)``…— comparten la mecánica base, así que se
reconocen por prefijo. Variants with their own tables or pool are resolved inside the
amount functions, which take the skill name.

Pensado para crecer: cuando se modelen otras skills (dream shards, charge
strength…), cada una suma su propia tabla/función acá sin tocar el resto.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sleepmon.domain.catalog_data import MAX_SKILL_LEVEL
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Ingredient

# Prefijo del nombre de la familia Ingredient Draw S. Las variantes agregan un
# pasivo entre paréntesis pero sortean ingredientes con la misma mecánica.
_INGREDIENT_DRAW_PREFIX = "Ingredient Draw S"

# Ingredientes que entrega un disparo de Ingredient Draw S según el nivel de la
# skill (1..MAX_SKILL_LEVEL). Indexado por ``nivel - 1``.
INGREDIENT_DRAW_AMOUNTS: tuple[int, ...] = (5, 6, 8, 11, 13, 16, 18)

assert len(INGREDIENT_DRAW_AMOUNTS) == MAX_SKILL_LEVEL


def draws_ingredients(species: Species) -> bool:
    """¿La main skill de la especie produce ingredientes (familia Ingredient Draw S)?"""
    return species.main_skill.startswith(_INGREDIENT_DRAW_PREFIX)


_SUPER_LUCK = "Ingredient Draw S (Super Luck)"
_HYPER_CUTTER = "Ingredient Draw S (Hyper Cutter)"

# Super Luck and Hyper Cutter draw from a fixed selection, not the species' ingredients.
_SUPER_LUCK_POOL: Final = (
    Ingredient.TASTY_MUSHROOM,
    Ingredient.BEAN_SAUSAGE,
    Ingredient.GREENGRASS_SOYBEANS,
    Ingredient.ROUSING_COFFEE,
)
_HYPER_CUTTER_POOL: Final = (
    Ingredient.SOFT_POTATO,
    Ingredient.PURE_OIL,
    Ingredient.SNOOZY_TOMATO,
    Ingredient.GREENGRASS_CORN,
)

# Super Luck: per trigger, a small or a big Dream Shard haul instead of ingredients.
SUPER_LUCK_SMALL_SHARDS_RATE: Final[float] = 0.121
SUPER_LUCK_BIG_SHARDS_RATE: Final[float] = 0.027
SUPER_LUCK_DREAM_SHARD_AMOUNTS: tuple[int, ...] = (500, 720, 1030, 1440, 2000, 2800, 4000)
SUPER_LUCK_BIG_DREAM_SHARD_AMOUNTS: tuple[int, ...] = (
    2500, 3600, 5150, 7200, 10000, 14000, 20000,
)
# Hyper Cutter: chance per trigger of getting twice the ingredients.
HYPER_CUTTER_DOUBLE_RATE: Final[float] = 0.164

assert len(SUPER_LUCK_DREAM_SHARD_AMOUNTS) == MAX_SKILL_LEVEL
assert len(SUPER_LUCK_BIG_DREAM_SHARD_AMOUNTS) == MAX_SKILL_LEVEL


def ingredient_draw_pool(species: Species) -> tuple[Ingredient, ...]:
    """Pool de ingredientes que sortea Ingredient Draw S: los de la especie, sin
    repetir y conservando el orden del juego (Super Luck / Hyper Cutter: their own)."""
    if species.main_skill.startswith(_SUPER_LUCK):
        return _SUPER_LUCK_POOL
    if species.main_skill.startswith(_HYPER_CUTTER):
        return _HYPER_CUTTER_POOL
    seen: list[Ingredient] = []
    for ingredient in species.ingredients:
        if ingredient not in seen:
            seen.append(ingredient)
    return tuple(seen)


def ingredient_draw_amount(main_skill: str, skill_level: int) -> float:
    """Ingredientes ESPERADOS por disparo de Ingredient Draw S al ``skill_level`` dado.

    Super Luck only yields them when it doesn't hit Dream Shards; Hyper Cutter
    sometimes doubles them. Se acota al rango válido (1..MAX_SKILL_LEVEL).
    """
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    amount = INGREDIENT_DRAW_AMOUNTS[level - 1]
    if main_skill.startswith(_SUPER_LUCK):
        return amount * (1 - SUPER_LUCK_SMALL_SHARDS_RATE - SUPER_LUCK_BIG_SHARDS_RATE)
    if main_skill.startswith(_HYPER_CUTTER):
        return amount * (1 + HYPER_CUTTER_DOUBLE_RATE)
    return amount


# Prefijo de la familia Energy for Everyone S (E4E). Las variantes con pasivo
# extra (p. ej. "(Lunar Blessing)") restauran energía al equipo como la base.
_ENERGY_FOR_EVERYONE_PREFIX = "Energy for Everyone S"

# Energía que E4E restaura a CADA compañero por disparo, según el nivel de la skill
# (1..6). Indexado por ``nivel - 1``. E4E topa en nivel 6 (no tiene nivel 7).
ENERGY_FOR_EVERYONE_AMOUNTS: tuple[int, ...] = (5, 7, 9, 11, 15, 18)
# Lunar Blessing (Cresselia) trades energy for its berries: a smaller table.
ENERGY_FOR_EVERYONE_LUNAR_BLESSING_AMOUNTS: tuple[int, ...] = (3, 4, 5, 7, 9, 11)


def restores_team_energy(species: Species) -> bool:
    """¿La main skill de la especie restaura energía al equipo (familia E4E)?"""
    return species.main_skill.startswith(_ENERGY_FOR_EVERYONE_PREFIX)


def energy_for_everyone_amount(main_skill: str, skill_level: int) -> int:
    """Energía que E4E restaura a cada compañero por disparo al ``skill_level`` dado.

    Se acota al rango de la tabla (E4E topa en nivel 6): un nivel mayor usa el tope.
    """
    table = (
        ENERGY_FOR_EVERYONE_LUNAR_BLESSING_AMOUNTS
        if main_skill.startswith("Energy for Everyone S (Lunar Blessing)")
        else ENERGY_FOR_EVERYONE_AMOUNTS
    )
    level = min(max(skill_level, 1), len(table))
    return table[level - 1]


# Prefijo de la familia Ingredient Magnet S. Las variantes con pasivo extra
# ("(Plus)", "(Present)") consiguen ingredientes al azar como la base.
_INGREDIENT_MAGNET_PREFIX = "Ingredient Magnet S"

# Ingredientes (de cualquier tipo, al azar) que consigue un disparo de Ingredient
# Magnet S según el nivel de la skill (1..7). Indexado por ``nivel - 1``.
INGREDIENT_MAGNET_AMOUNTS: tuple[int, ...] = (6, 8, 11, 14, 17, 21, 24)
# Present (Delibird) has its own, smaller table.
INGREDIENT_MAGNET_PRESENT_AMOUNTS: tuple[int, ...] = (4, 6, 8, 10, 12, 15, 17)

assert len(INGREDIENT_MAGNET_AMOUNTS) == MAX_SKILL_LEVEL
assert len(INGREDIENT_MAGNET_PRESENT_AMOUNTS) == MAX_SKILL_LEVEL


def magnets_ingredients(species: Species) -> bool:
    """¿La main skill de la especie consigue ingredientes al azar (familia Magnet)?"""
    return species.main_skill.startswith(_INGREDIENT_MAGNET_PREFIX)


def ingredient_magnet_amount(main_skill: str, skill_level: int) -> int:
    """Ingredientes por disparo de Ingredient Magnet S al ``skill_level`` dado."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    if main_skill.startswith("Ingredient Magnet S (Present)"):
        return INGREDIENT_MAGNET_PRESENT_AMOUNTS[level - 1]
    return INGREDIENT_MAGNET_AMOUNTS[level - 1]


# Prefijo de la familia Cooking Power-Up S. La variante "(Minus)" agranda el pote
# igual que la base.
_COOKING_POWER_UP_PREFIX = "Cooking Power-Up S"

# Ingredientes extra de pote que da un disparo de Cooking Power-Up S según el nivel
# de la skill (1..7). Indexado por ``nivel - 1``.
COOKING_POWER_UP_AMOUNTS: tuple[int, ...] = (7, 10, 12, 17, 22, 27, 31)

assert len(COOKING_POWER_UP_AMOUNTS) == MAX_SKILL_LEVEL


def powers_up_cooking(species: Species) -> bool:
    """¿La main skill de la especie agranda el pote (familia Cooking Power-Up S)?"""
    return species.main_skill.startswith(_COOKING_POWER_UP_PREFIX)


def cooking_power_up_amount(skill_level: int) -> int:
    """Ingredientes extra de pote por disparo de Cooking Power-Up S al nivel dado."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return COOKING_POWER_UP_AMOUNTS[level - 1]


# --- Sinergia Plus/Minun (Plusle y Minun) --------------------------------------
# Plusle y Minun tienen variantes de Ingredient Magnet / Cooking Power-Up con tablas
# base PROPIAS (distintas de las regulares) y un bonus que se dispara si hay otro
# Pokémon Plus/Minus en el equipo. Modelamos asumiendo que esa condición SIEMPRE se
# cumple, así que el bonus siempre suma.

_INGREDIENT_MAGNET_PLUS_PREFIX = "Ingredient Magnet S (Plus)"
# Base: ingredientes al azar por disparo (1..7). Bonus: ingredientes de un tipo FIJO
# por disparo si hay compañero Plus/Minus —el tipo depende de la especie (Plusle da
# café; Toxtricity (Amped) da leche).
INGREDIENT_MAGNET_PLUS_BASE: tuple[int, ...] = (5, 7, 9, 11, 13, 16, 18)
INGREDIENT_MAGNET_PLUS_BONUS: tuple[int, ...] = (6, 7, 8, 9, 10, 11, 12)
_MAGNET_PLUS_BONUS_INGREDIENT: dict[str, Ingredient] = {
    "Plusle": Ingredient.ROUSING_COFFEE,
    "Toxtricity (Amped)": Ingredient.MOOMOO_MILK,
}

_COOKING_POWER_UP_MINUS_PREFIX = "Cooking Power-Up S (Minus)"
# Base: ingredientes extra de pote por disparo (1..7). Bonus: energía a un compañero
# al azar si hay otro Pokémon Plus/Minus en el equipo.
COOKING_POWER_UP_MINUS_POT: tuple[int, ...] = (5, 7, 9, 12, 16, 20, 24)
COOKING_POWER_UP_MINUS_ENERGY: tuple[int, ...] = (8, 10, 13, 17, 23, 30, 35)


def is_magnet_plus(species: Species) -> bool:
    """¿Es Ingredient Magnet S (Plus) (Plusle)?"""
    return species.main_skill.startswith(_INGREDIENT_MAGNET_PLUS_PREFIX)


def magnet_plus_base_amount(skill_level: int) -> int:
    """Ingredientes AL AZAR por disparo de Ingredient Magnet S (Plus) al nivel dado."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return INGREDIENT_MAGNET_PLUS_BASE[level - 1]


def magnet_plus_bonus_amount(skill_level: int) -> int:
    """Ingredientes del tipo fijo (bonus de sinergia) por disparo de Ingredient Magnet S
    (Plus) al nivel dado, asumiendo compañero Plus/Minus presente."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return INGREDIENT_MAGNET_PLUS_BONUS[level - 1]


def magnet_plus_bonus_ingredient(species: Species) -> Ingredient | None:
    """Ingrediente fijo que da el bonus de Ingredient Magnet S (Plus) para esta especie
    (Plusle: café; Toxtricity (Amped): leche). ``None`` si no se conoce."""
    return _MAGNET_PLUS_BONUS_INGREDIENT.get(species.name)


def is_cooking_minus(species: Species) -> bool:
    """¿Es Cooking Power-Up S (Minus) (Minun)?"""
    return species.main_skill.startswith(_COOKING_POWER_UP_MINUS_PREFIX)


def cooking_minus_pot_amount(skill_level: int) -> int:
    """Ingredientes extra de pote por disparo de Cooking Power-Up S (Minus) al nivel dado."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return COOKING_POWER_UP_MINUS_POT[level - 1]


def cooking_minus_energy_amount(skill_level: int) -> int:
    """Energía a un compañero al azar por disparo del bonus de Cooking Power-Up S (Minus)
    (asumiendo compañero Plus/Minus presente)."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return COOKING_POWER_UP_MINUS_ENERGY[level - 1]


# Fuerza por disparo de Charge Strength S y M (montos FIJOS), por nivel (1..7).
CHARGE_STRENGTH_S_AMOUNTS: tuple[int, ...] = (400, 569, 785, 1083, 1496, 2066, 3212)
CHARGE_STRENGTH_M_AMOUNTS: tuple[int, ...] = (880, 1251, 1726, 2383, 3290, 4546, 6858)
# Charge Strength S (Random): rango (min, max) por nivel. El monto es uniforme entre
# ambos, así que el valor esperado es el punto medio.
CHARGE_STRENGTH_S_RANDOM_RANGES: tuple[tuple[int, int], ...] = (
    (200, 800),
    (285, 1138),
    (393, 1570),
    (542, 2166),
    (748, 2992),
    (1033, 4132),
    (1606, 6424),
)

# Stockpile stores triggers and spits them out later; this is its average per trigger.
CHARGE_STRENGTH_S_STOCKPILE_AVERAGE: tuple[int, ...] = (600, 853, 1177, 1625, 2243, 3099, 4497)
# Strength added by skills whose main effect is something else (levels 1..8 / 1..6).
AURA_SPHERE_STRENGTH_AMOUNTS: tuple[int, ...] = (200, 285, 393, 542, 748, 1033, 1501, 2042)
BERRY_ZONE_PSYSTRIKE_STRENGTH_AMOUNTS: tuple[int, ...] = (1408, 2002, 2762, 3813, 5264, 7274)

assert len(CHARGE_STRENGTH_S_AMOUNTS) == MAX_SKILL_LEVEL
assert len(CHARGE_STRENGTH_S_STOCKPILE_AVERAGE) == MAX_SKILL_LEVEL
assert len(CHARGE_STRENGTH_M_AMOUNTS) == MAX_SKILL_LEVEL
assert len(CHARGE_STRENGTH_S_RANDOM_RANGES) == MAX_SKILL_LEVEL


def skill_strength_amount(main_skill: str, skill_level: int) -> float | None:
    """Fuerza ESPERADA por disparo que la skill suma a Snorlax al nivel dado.

    Charge Strength: valor de tabla para S y M, punto medio del rango para S (Random),
    average per trigger for S (Stockpile). Also the Strength half of Aura Sphere and
    Psystrike. ``None`` si la skill no suma fuerza. El orden de los chequeos importa:
    las variantes (Random)/(Stockpile) empiezan con "Charge Strength S".
    """
    if main_skill.startswith("Dream Shard Magnet S (Aura Sphere)"):
        table: tuple[int, ...] = AURA_SPHERE_STRENGTH_AMOUNTS
        return table[min(max(skill_level, 1), len(table)) - 1]
    if main_skill.startswith("Berry Zone (Psystrike)"):
        table = BERRY_ZONE_PSYSTRIKE_STRENGTH_AMOUNTS
        return table[min(max(skill_level, 1), len(table)) - 1]
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    if main_skill.startswith("Charge Strength M"):
        return CHARGE_STRENGTH_M_AMOUNTS[level - 1]
    if main_skill.startswith("Charge Strength S (Random)"):
        low, high = CHARGE_STRENGTH_S_RANDOM_RANGES[level - 1]
        return (low + high) / 2
    if main_skill.startswith("Charge Strength S (Stockpile)"):
        return CHARGE_STRENGTH_S_STOCKPILE_AVERAGE[level - 1]
    if main_skill.startswith("Charge Strength S"):
        return CHARGE_STRENGTH_S_AMOUNTS[level - 1]
    return None


# Prefijo de la familia Charge Energy S. La variante "(Moonlight)" carga energía al
# usuario igual que la base.
_CHARGE_ENERGY_PREFIX = "Charge Energy S"

# Energía que Charge Energy S restaura al PROPIO Pokémon por disparo, según el nivel
# de la skill (1..6). Indexado por ``nivel - 1``. Topa en nivel 6 (no tiene nivel 7).
CHARGE_ENERGY_S_AMOUNTS: tuple[int, ...] = (12, 16, 21, 26, 33, 43)


def charges_self_energy(species: Species) -> bool:
    """¿La main skill de la especie carga energía al propio Pokémon (familia Charge Energy)?"""
    return species.main_skill.startswith(_CHARGE_ENERGY_PREFIX)


def charge_energy_amount(skill_level: int) -> int:
    """Energía que Charge Energy S restaura al usuario por disparo al nivel dado.

    Se acota al rango de la tabla (topa en nivel 6): un nivel mayor usa el tope.
    """
    level = min(max(skill_level, 1), len(CHARGE_ENERGY_S_AMOUNTS))
    return CHARGE_ENERGY_S_AMOUNTS[level - 1]


# Fragmentos de sueño de Dream Shard Magnet S (monto FIJO) por nivel (1..8).
DREAM_SHARD_MAGNET_S_AMOUNTS: tuple[int, ...] = (240, 340, 480, 670, 920, 1260, 1800, 2500)
# Variante S (Random): rango (min, max) por nivel (1..8). Monto uniforme -> punto medio.
DREAM_SHARD_MAGNET_S_RANDOM_RANGES: tuple[tuple[int, int], ...] = (
    (120, 480),
    (170, 680),
    (240, 960),
    (335, 1340),
    (460, 1840),
    (630, 2520),
    (900, 3600),
    (1150, 4600),
)


def dream_shard_amount(main_skill: str, skill_level: int) -> float | None:
    """Fragmentos de sueño ESPERADOS por disparo de Dream Shard Magnet S al nivel dado.

    Monto fijo para la variante base (and Aura Sphere); punto medio del rango para
    S (Random); for Ingredient Draw S (Super Luck), its occasional shard hauls.
    ``None`` si la skill no consigue fragmentos. El orden importa: (Random) empieza
    con el mismo prefijo que la base, así que se descarta antes.
    """
    if main_skill.startswith(_SUPER_LUCK):
        draw_level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
        return (
            SUPER_LUCK_SMALL_SHARDS_RATE * SUPER_LUCK_DREAM_SHARD_AMOUNTS[draw_level - 1]
            + SUPER_LUCK_BIG_SHARDS_RATE * SUPER_LUCK_BIG_DREAM_SHARD_AMOUNTS[draw_level - 1]
        )
    level = min(max(skill_level, 1), len(DREAM_SHARD_MAGNET_S_AMOUNTS))
    if main_skill.startswith("Dream Shard Magnet S (Random)"):
        low, high = DREAM_SHARD_MAGNET_S_RANDOM_RANGES[level - 1]
        return (low + high) / 2
    if main_skill.startswith("Dream Shard Magnet S"):
        return DREAM_SHARD_MAGNET_S_AMOUNTS[level - 1]
    return None


# Prefijo de la familia Tasty Chance S.
_TASTY_CHANCE_PREFIX = "Tasty Chance S"

# Aumento (en puntos porcentuales) de la probabilidad de Extra Tasty que da un
# disparo de Tasty Chance S según el nivel de la skill (1..6). Topa en nivel 6.
TASTY_CHANCE_S_AMOUNTS: tuple[int, ...] = (4, 5, 6, 7, 8, 10)


def boosts_tasty_chance(species: Species) -> bool:
    """¿La main skill de la especie sube la probabilidad de Extra Tasty (familia Tasty Chance)?"""
    return species.main_skill.startswith(_TASTY_CHANCE_PREFIX)


def tasty_chance_amount(skill_level: int) -> int:
    """Puntos porcentuales de Extra Tasty que da un disparo de Tasty Chance S al nivel dado.

    Se acota al rango de la tabla (topa en nivel 6).
    """
    level = min(max(skill_level, 1), len(TASTY_CHANCE_S_AMOUNTS))
    return TASTY_CHANCE_S_AMOUNTS[level - 1]


# Prefijo de la familia Extra Helpful S.
_EXTRA_HELPFUL_PREFIX = "Extra Helpful S"

# Multiplicador de ayuda (×N) que entrega un disparo de Extra Helpful S según el nivel
# de la skill (1..7). Indexado por ``nivel - 1``.
EXTRA_HELPFUL_S_AMOUNTS: tuple[int, ...] = (6, 7, 8, 9, 10, 11, 12)

assert len(EXTRA_HELPFUL_S_AMOUNTS) == MAX_SKILL_LEVEL


def is_extra_helpful(species: Species) -> bool:
    """¿La main skill de la especie da ayuda instantánea (familia Extra Helpful S)?"""
    return species.main_skill.startswith(_EXTRA_HELPFUL_PREFIX)


def extra_helpful_amount(skill_level: int) -> int:
    """Multiplicador de ayuda (×N) por disparo de Extra Helpful S al nivel dado."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return EXTRA_HELPFUL_S_AMOUNTS[level - 1]


# Prefijo de la familia Energizing Cheer S. Las variantes con pasivo extra
# ("(Heal Pulse)", "(Nuzzle)") reparten energía como la base.
_ENERGIZING_CHEER_PREFIX = "Energizing Cheer S"

# Energía que Energizing Cheer S restaura a un compañero al azar por disparo, según
# el nivel de la skill (1..6). Topa en nivel 6 (no tiene nivel 7).
ENERGIZING_CHEER_S_AMOUNTS: tuple[int, ...] = (14, 17, 22, 28, 38, 50)
# Heal Pulse (Latias) gives this to each of TWO teammates; Nuzzle (Togedemaru) to one.
ENERGIZING_CHEER_HEAL_PULSE_AMOUNTS: tuple[int, ...] = (6, 8, 10, 13, 17, 22)
ENERGIZING_CHEER_NUZZLE_AMOUNTS: tuple[int, ...] = (9, 12, 16, 20, 27, 35)


def cheers_random_energy(species: Species) -> bool:
    """¿La main skill restaura energía a un compañero al azar (familia Energizing Cheer)?"""
    return species.main_skill.startswith(_ENERGIZING_CHEER_PREFIX)


def energizing_cheer_amount(main_skill: str, skill_level: int) -> int:
    """Energía TOTAL que Energizing Cheer S reparte por disparo al nivel dado.

    Heal Pulse counts both of its targets. Se acota al rango de la tabla (topa en 6).
    """
    level = min(max(skill_level, 1), len(ENERGIZING_CHEER_S_AMOUNTS))
    if main_skill.startswith("Energizing Cheer S (Heal Pulse)"):
        return 2 * ENERGIZING_CHEER_HEAL_PULSE_AMOUNTS[level - 1]
    if main_skill.startswith("Energizing Cheer S (Nuzzle)"):
        return ENERGIZING_CHEER_NUZZLE_AMOUNTS[level - 1]
    return ENERGIZING_CHEER_S_AMOUNTS[level - 1]


# --- Cooking Assist S --------------------------------------------------------------
# Random ingredients per trigger (like Ingredient Magnet); Bulk Up (Heracross) also
# raises the Extra Tasty rate by a few points per trigger.
_COOKING_ASSIST_PREFIX = "Cooking Assist S"

COOKING_ASSIST_S_INGREDIENTS: tuple[int, ...] = (6, 8, 11, 14, 17, 21, 24)
BULK_UP_TASTY_CHANCE_AMOUNTS: tuple[int, ...] = (1, 2, 2, 3, 3, 4, 5)

assert len(COOKING_ASSIST_S_INGREDIENTS) == MAX_SKILL_LEVEL
assert len(BULK_UP_TASTY_CHANCE_AMOUNTS) == MAX_SKILL_LEVEL


def assists_cooking(species: Species) -> bool:
    """Is the species' main skill in the Cooking Assist S family?"""
    return species.main_skill.startswith(_COOKING_ASSIST_PREFIX)


def cooking_assist_ingredients(skill_level: int) -> int:
    """Random ingredients per Cooking Assist S trigger at the given level."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return COOKING_ASSIST_S_INGREDIENTS[level - 1]


def cooking_assist_tasty_chance(main_skill: str, skill_level: int) -> int | None:
    """Extra Tasty points per trigger of Bulk Up; None for skills without it."""
    if not main_skill.startswith("Cooking Assist S (Bulk Up)"):
        return None
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return BULK_UP_TASTY_CHANCE_AMOUNTS[level - 1]


# --- Berry Burst ----------------------------------------------------------------
# Each trigger gets own berries plus N of each teammate's berry. Caps at level 6.
_BERRY_BURST_PREFIX = "Berry Burst"
_DISGUISE = "Berry Burst (Disguise)"
_DRACO_METEOR = "Berry Burst (Draco Meteor)"

BERRY_BURST_OWN: tuple[int, ...] = (11, 14, 21, 24, 27, 30)
BERRY_BURST_DISGUISE_OWN: tuple[int, ...] = (8, 10, 15, 17, 19, 21)
BERRY_BURST_PER_TEAMMATE: tuple[int, ...] = (1, 2, 2, 3, 4, 5)
# Disguise: chance per trigger of a Great Success (triples it), at most once a day.
DISGUISE_GREAT_SUCCESS_RATE: Final[float] = 0.185
# Draco Meteor: [skill_level - 1][same_berry_species - 1] -> (own, per_teammate).
DRACO_METEOR_AMOUNTS: tuple[tuple[tuple[int, int], ...], ...] = (
    ((12, 1), (14, 1), (18, 1), (18, 2), (20, 2)),
    ((21, 1), (24, 1), (29, 1), (30, 2), (33, 2)),
    ((29, 1), (29, 2), (35, 2), (37, 3), (41, 3)),
    ((38, 1), (39, 2), (42, 3), (45, 4), (49, 4)),
    ((43, 2), (44, 3), (48, 4), (49, 5), (53, 5)),
    ((48, 3), (50, 4), (55, 4), (55, 5), (58, 5)),
)
# Extra own berries for Draco Meteor when Latias is on the team.
DRACO_METEOR_LATIAS_BONUS: tuple[int, ...] = (2, 4, 6, 8, 9, 10)

# Lunar Blessing (Cresselia) gets berries on top of its team energy, the same way:
# [skill_level - 1][same_berry_species - 1] -> (own, per_teammate).
_LUNAR_BLESSING = "Energy for Everyone S (Lunar Blessing)"
LUNAR_BLESSING_BERRIES: tuple[tuple[tuple[int, int], ...], ...] = (
    ((5, 1), (7, 1), (9, 1), (12, 1), (14, 2)),
    ((9, 1), (12, 1), (15, 1), (16, 2), (19, 3)),
    ((13, 1), (17, 1), (18, 2), (20, 3), (24, 4)),
    ((17, 1), (19, 2), (25, 2), (28, 3), (29, 5)),
    ((21, 1), (24, 2), (27, 3), (28, 5), (30, 7)),
    ((25, 1), (29, 2), (30, 4), (31, 6), (32, 9)),
)

assert len(BERRY_BURST_DISGUISE_OWN) == len(BERRY_BURST_OWN) == len(BERRY_BURST_PER_TEAMMATE)
assert len(DRACO_METEOR_AMOUNTS) == len(DRACO_METEOR_LATIAS_BONUS) == len(BERRY_BURST_OWN)
assert len(LUNAR_BLESSING_BERRIES) == len(BERRY_BURST_OWN)


@dataclass(frozen=True, slots=True)
class TeamContext:
    """Team context some skills read; the default is the floor (alone)."""

    same_berry_species: int = 1  # distinct species sharing the member's berry, self included
    latias: bool = False  # Draco Meteor's bonus
    latios: bool = False  # Heal Pulse's bonus


NO_TEAM_CONTEXT = TeamContext()


@dataclass(frozen=True, slots=True)
class BerryBurstAmounts:
    own: int  # own berries per trigger
    per_teammate: int  # berries of each teammate per trigger


def bursts_berries(species: Species) -> bool:
    """Is the species' main skill in the Berry Burst family?"""
    return species.main_skill.startswith(_BERRY_BURST_PREFIX)


def berry_burst_amounts(
    main_skill: str, skill_level: int, team: TeamContext = NO_TEAM_CONTEXT
) -> BerryBurstAmounts | None:
    """Berries per trigger at ``skill_level`` (clamped 1..6) for Berry Burst and Lunar
    Blessing; None for skills that don't get berries."""
    level = min(max(skill_level, 1), len(BERRY_BURST_OWN))
    if main_skill.startswith(_LUNAR_BLESSING):
        by_species = LUNAR_BLESSING_BERRIES[level - 1]
        species = min(max(team.same_berry_species, 1), len(by_species))
        return BerryBurstAmounts(*by_species[species - 1])
    if not main_skill.startswith(_BERRY_BURST_PREFIX):
        return None
    if main_skill.startswith(_DRACO_METEOR):
        by_species = DRACO_METEOR_AMOUNTS[level - 1]
        species = min(max(team.same_berry_species, 1), len(by_species))
        own, per_teammate = by_species[species - 1]
        if team.latias:
            own += DRACO_METEOR_LATIAS_BONUS[level - 1]
        return BerryBurstAmounts(own, per_teammate)
    own_table = BERRY_BURST_DISGUISE_OWN if main_skill.startswith(_DISGUISE) else BERRY_BURST_OWN
    return BerryBurstAmounts(own_table[level - 1], BERRY_BURST_PER_TEAMMATE[level - 1])


def berry_burst_triggers(main_skill: str, triggers: float) -> float:
    """Effective triggers/day: Disguise adds 2 x P(at least one Great Success)."""
    if main_skill.startswith(_DISGUISE):
        prob_at_least_one: float = 1 - (1 - DISGUISE_GREAT_SUCCESS_RATE) ** triggers
        return triggers + 2 * prob_at_least_one
    return triggers


# --- Skills that grant helps to team members ---------------------------------------
# Helper Boost: helps for every member, plus a bonus by same-berry species (1..5).
HELPER_BOOST_HELPS: tuple[int, ...] = (2, 3, 3, 4, 4, 5)
HELPER_BOOST_SAME_BERRY_BONUS: tuple[tuple[int, ...], ...] = (
    (0, 0, 0, 0, 0, 0),
    (0, 0, 0, 0, 1, 1),
    (1, 1, 2, 2, 3, 3),
    (2, 2, 3, 3, 4, 4),
    (4, 4, 5, 5, 6, 6),
)
# Heal Pulse (Latias): helps for each of its two targets; more with Latios on the team.
HEAL_PULSE_HELPS: tuple[int, ...] = (1, 2, 2, 3, 4, 4)
HEAL_PULSE_LATIOS_HELPS: tuple[int, ...] = (1, 1, 2, 2, 2, 3)
WHOLE_TEAM: Final = 5  # targets count that reaches every member

assert all(len(row) == len(HELPER_BOOST_HELPS) for row in HELPER_BOOST_SAME_BERRY_BONUS)
assert len(HEAL_PULSE_HELPS) == len(HEAL_PULSE_LATIOS_HELPS)


@dataclass(frozen=True, slots=True)
class HelpGrantPerTrigger:
    helps: int  # helps each target gets per trigger
    targets: int  # random members reached per trigger (WHOLE_TEAM: everyone)


def help_grant(
    main_skill: str, skill_level: int, team: TeamContext = NO_TEAM_CONTEXT
) -> HelpGrantPerTrigger | None:
    """Helps a trigger grants team members; None for skills that grant none."""
    if main_skill.startswith(_EXTRA_HELPFUL_PREFIX):
        return HelpGrantPerTrigger(extra_helpful_amount(skill_level), 1)
    if main_skill.startswith("Helper Boost"):
        level = min(max(skill_level, 1), len(HELPER_BOOST_HELPS))
        species = min(max(team.same_berry_species, 1), len(HELPER_BOOST_SAME_BERRY_BONUS))
        bonus = HELPER_BOOST_SAME_BERRY_BONUS[species - 1][level - 1]
        return HelpGrantPerTrigger(HELPER_BOOST_HELPS[level - 1] + bonus, WHOLE_TEAM)
    if main_skill.startswith("Energizing Cheer S (Heal Pulse)"):
        level = min(max(skill_level, 1), len(HEAL_PULSE_HELPS))
        helps = HEAL_PULSE_HELPS[level - 1]
        if team.latios:
            helps += HEAL_PULSE_LATIOS_HELPS[level - 1]
        return HelpGrantPerTrigger(helps, 2)
    return None


# Moonlight (Umbreon): half the time a trigger also restores energy to a teammate.
MOONLIGHT_SHARE_CHANCE: Final[float] = 0.5
MOONLIGHT_SHARED_ENERGY: tuple[float, ...] = (6.3, 7.7, 10.1, 13.0, 17.2, 22.8)


def moonlight_shared_energy(main_skill: str, skill_level: int) -> float | None:
    """Expected energy per trigger Moonlight gives a teammate; None for other skills."""
    if not main_skill.startswith("Charge Energy S (Moonlight)"):
        return None
    level = min(max(skill_level, 1), len(MOONLIGHT_SHARED_ENERGY))
    return MOONLIGHT_SHARE_CHANCE * MOONLIGHT_SHARED_ENERGY[level - 1]


def max_skill_level(main_skill: str) -> int:
    """The real cap of a given main skill: the length of its own amounts table.

    Most skills cap at MAX_SKILL_LEVEL (7); Energy for Everyone S, Tasty Chance S,
    Charge Energy S, Energizing Cheer S, Berry Burst, Berry Zone (Psystrike), and Helper
    Boost cap at 6; Dream Shard Magnet S reaches 8. Matched by prefix like the amount functions.
    """
    if main_skill.startswith("Berry Zone (Psystrike)"):
        return len(BERRY_ZONE_PSYSTRIKE_STRENGTH_AMOUNTS)
    if main_skill.startswith("Helper Boost"):
        return len(HELPER_BOOST_HELPS)
    if main_skill.startswith("Dream Shard Magnet S"):
        return len(DREAM_SHARD_MAGNET_S_AMOUNTS)
    if main_skill.startswith(_BERRY_BURST_PREFIX):
        return len(BERRY_BURST_OWN)
    if main_skill.startswith(_ENERGY_FOR_EVERYONE_PREFIX):
        return len(ENERGY_FOR_EVERYONE_AMOUNTS)
    if main_skill.startswith(_TASTY_CHANCE_PREFIX):
        return len(TASTY_CHANCE_S_AMOUNTS)
    if main_skill.startswith(_CHARGE_ENERGY_PREFIX):
        return len(CHARGE_ENERGY_S_AMOUNTS)
    if main_skill.startswith(_ENERGIZING_CHEER_PREFIX):
        return len(ENERGIZING_CHEER_S_AMOUNTS)
    return MAX_SKILL_LEVEL
