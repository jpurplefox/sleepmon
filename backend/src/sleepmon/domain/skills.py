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
  acumula y no se modela todavía.
- **Charge Energy S**: al dispararse restaura una cantidad fija de energía al *propio*
  Pokémon (no al equipo), según el nivel de la skill.
- **Dream Shard Magnet S**: al dispararse consigue fragmentos de sueño. Tiene una
  variante de monto fijo y otra S (Random) con monto aleatorio uniforme entre dos
  valores (usamos el punto medio para estimar). Llega hasta nivel 8.
- **Tasty Chance S**: al dispararse sube la probabilidad de "Extra Tasty" al cocinar
  en un porcentaje fijo (según el nivel). El boost se ACUMULA con cada disparo, así que
  se reporta ``disparos × %_del_nivel`` (sin acotar al tope de stack del juego).
- **Extra Helpful S**: al dispararse entrega instantáneamente ``×N`` la ayuda normal de
  un Pokémon (N según el nivel). Se reporta el multiplicador total del día:
  ``disparos × N``.
- **Energizing Cheer S**: al dispararse restaura energía a OTRO Pokémon del equipo
  elegido al azar (cantidad según el nivel). Se reporta el total del día que reparte
  al equipo: ``disparos × cantidad_del_nivel``.

La main skill se identifica por su nombre (``Species.main_skill`` es un string del
catálogo). Las variantes con pasivo extra —``Ingredient Draw S (Super Luck)``,
``Energy for Everyone S (Lunar Blessing)``…— comparten la mecánica base, así que se
reconocen por prefijo.

Pensado para crecer: cuando se modelen otras skills (dream shards, charge
strength…), cada una suma su propia tabla/función acá sin tocar el resto.
"""

from __future__ import annotations

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


def ingredient_draw_pool(species: Species) -> tuple[Ingredient, ...]:
    """Pool de ingredientes que sortea Ingredient Draw S: los de la especie, sin
    repetir y conservando el orden del juego."""
    seen: list[Ingredient] = []
    for ingredient in species.ingredients:
        if ingredient not in seen:
            seen.append(ingredient)
    return tuple(seen)


def ingredient_draw_amount(skill_level: int) -> int:
    """Ingredientes por disparo de Ingredient Draw S al ``skill_level`` dado.

    Se acota al rango válido (1..MAX_SKILL_LEVEL) por las dudas; la validación de
    rango propiamente dicha vive en la entidad y la aplicación.
    """
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    return INGREDIENT_DRAW_AMOUNTS[level - 1]


# Prefijo de la familia Energy for Everyone S (E4E). Las variantes con pasivo
# extra (p. ej. "(Lunar Blessing)") restauran energía al equipo igual que la base.
_ENERGY_FOR_EVERYONE_PREFIX = "Energy for Everyone S"

# Energía que E4E restaura a CADA compañero por disparo, según el nivel de la skill
# (1..6). Indexado por ``nivel - 1``. E4E topa en nivel 6 (no tiene nivel 7).
ENERGY_FOR_EVERYONE_AMOUNTS: tuple[int, ...] = (5, 7, 9, 11, 15, 18)


def restores_team_energy(species: Species) -> bool:
    """¿La main skill de la especie restaura energía al equipo (familia E4E)?"""
    return species.main_skill.startswith(_ENERGY_FOR_EVERYONE_PREFIX)


def energy_for_everyone_amount(skill_level: int) -> int:
    """Energía que E4E restaura a cada compañero por disparo al ``skill_level`` dado.

    Se acota al rango de la tabla (E4E topa en nivel 6): un nivel mayor usa el tope.
    """
    level = min(max(skill_level, 1), len(ENERGY_FOR_EVERYONE_AMOUNTS))
    return ENERGY_FOR_EVERYONE_AMOUNTS[level - 1]


# Prefijo de la familia Ingredient Magnet S. Las variantes con pasivo extra
# ("(Plus)", "(Present)") consiguen ingredientes igual que la base.
_INGREDIENT_MAGNET_PREFIX = "Ingredient Magnet S"

# Ingredientes (de cualquier tipo, al azar) que consigue un disparo de Ingredient
# Magnet S según el nivel de la skill (1..7). Indexado por ``nivel - 1``.
INGREDIENT_MAGNET_AMOUNTS: tuple[int, ...] = (6, 8, 11, 14, 17, 21, 24)

assert len(INGREDIENT_MAGNET_AMOUNTS) == MAX_SKILL_LEVEL


def magnets_ingredients(species: Species) -> bool:
    """¿La main skill de la especie consigue ingredientes al azar (familia Magnet)?"""
    return species.main_skill.startswith(_INGREDIENT_MAGNET_PREFIX)


def ingredient_magnet_amount(skill_level: int) -> int:
    """Ingredientes por disparo de Ingredient Magnet S al ``skill_level`` dado."""
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
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

assert len(CHARGE_STRENGTH_S_AMOUNTS) == MAX_SKILL_LEVEL
assert len(CHARGE_STRENGTH_M_AMOUNTS) == MAX_SKILL_LEVEL
assert len(CHARGE_STRENGTH_S_RANDOM_RANGES) == MAX_SKILL_LEVEL


def charge_strength_amount(main_skill: str, skill_level: int) -> float | None:
    """Fuerza ESPERADA por disparo de una skill Charge Strength al nivel dado.

    Para los montos fijos (S y M) es el valor de tabla; para S (Random) es el punto
    medio del rango (monto uniforme). Devuelve ``None`` si la skill no es una Charge
    Strength modelada (p. ej. la variante Stockpile, que acumula y no se estima).
    El orden de los chequeos importa: las variantes (Random)/(Stockpile) empiezan con
    "Charge Strength S", así que se descartan antes de la S fija.
    """
    level = min(max(skill_level, 1), MAX_SKILL_LEVEL)
    if main_skill.startswith("Charge Strength M"):
        return CHARGE_STRENGTH_M_AMOUNTS[level - 1]
    if main_skill.startswith("Charge Strength S (Random)"):
        low, high = CHARGE_STRENGTH_S_RANDOM_RANGES[level - 1]
        return (low + high) / 2
    if main_skill.startswith("Charge Strength S (Stockpile)"):
        return None
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

    Monto fijo para la variante base; punto medio del rango para S (Random). ``None``
    si la skill no es Dream Shard Magnet. El orden importa: (Random) empieza con el
    mismo prefijo que la base, así que se descarta antes.
    """
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
# ("(Heal Pulse)", "(Nuzzle)") reparten energía igual que la base.
_ENERGIZING_CHEER_PREFIX = "Energizing Cheer S"

# Energía que Energizing Cheer S restaura a un compañero al azar por disparo, según
# el nivel de la skill (1..6). Topa en nivel 6 (no tiene nivel 7).
ENERGIZING_CHEER_S_AMOUNTS: tuple[int, ...] = (14, 17, 22, 28, 38, 50)


def cheers_random_energy(species: Species) -> bool:
    """¿La main skill restaura energía a un compañero al azar (familia Energizing Cheer)?"""
    return species.main_skill.startswith(_ENERGIZING_CHEER_PREFIX)


def energizing_cheer_amount(skill_level: int) -> int:
    """Energía que Energizing Cheer S reparte por disparo al nivel dado.

    Se acota al rango de la tabla (topa en nivel 6).
    """
    level = min(max(skill_level, 1), len(ENERGIZING_CHEER_S_AMOUNTS))
    return ENERGIZING_CHEER_S_AMOUNTS[level - 1]
