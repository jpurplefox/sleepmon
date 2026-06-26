"""Catálogo de especies (datos de referencia que viajan con el código).

Cada especie fija su número de Pokédex, qué baya carga, su tipo de sueño, su main
skill y —lo que usa la validación— qué ingredientes son posibles en cada slot.

NOTA: este es un subconjunto **curado v1**, no las ~230 especies del juego, y los
sets de ingredientes por slot son la mejor aproximación disponible. Ampliarlo o
corregirlo es solo agregar/editar entradas de ``SEED_SPECIES`` — justamente el tipo
de dato que conviene auditar en bucle.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.catalog_data import MAX_INGREDIENTS
from sleepmon.domain.value_objects import Berry, Ingredient, SleepType, Specialty

I = Ingredient  # noqa: E741 — alias local para que el dataset se lea compacto


@dataclass(frozen=True, slots=True)
class Species:
    """Entrada del catálogo para una especie."""

    name: str
    dex: int  # número de Pokédex nacional (para el sprite en el front)
    specialty: Specialty
    berry: Berry
    sleep_type: SleepType
    main_skill: str
    # Ingredientes posibles de la especie, EN ORDEN (1º, 2º, 3º) tal como los
    # numera el juego. En Pokémon Sleep el ingrediente elegible en cada slot
    # depende del nivel y siempre es un prefijo de esta lista:
    #   slot 0 (nivel 1):  solo el 1º
    #   slot 1 (nivel 30): el 1º o el 2º
    #   slot 2 (nivel 60): cualquiera de los tres
    # Modelarlo como lista ordenada (y derivar los slots) hace imposible que un
    # ingrediente posterior aparezca en un slot temprano, y fija el orden de
    # display al orden del juego. Largo 1..3.
    ingredients: tuple[Ingredient, ...]
    # Datos de producción del juego (ver SEED_SPECIES).
    help_frequency_seconds: float  # frecuencia de ayuda base, en segundos (sin bonus)
    ingredient_percentage: float  # % de ayudas que dan ingrediente
    skill_percentage: float  # % de ayudas que disparan la main skill
    # Cantidad por slot Y por ingrediente: ``ingredient_amounts[slot][j]`` es cuánto
    # da ``ingredient_slots[slot][j]`` (un mismo ingrediente rinde distinto según el
    # slot, y distintos ingredientes rinden distinto en el mismo slot). La forma debe
    # coincidir con ``ingredient_slots`` (largos 1, 2, 3…).
    ingredient_amounts: tuple[tuple[int, ...], ...]
    base_inventory: int  # carry limit base (sin nivel ni sub skills)

    def __post_init__(self) -> None:
        if len(self.ingredient_amounts) != MAX_INGREDIENTS:
            raise ValueError(f"{self.name}: ingredient_amounts debe tener {MAX_INGREDIENTS} slots.")
        for slot, options in enumerate(self.ingredient_slots):
            if len(self.ingredient_amounts[slot]) != len(options):
                raise ValueError(
                    f"{self.name}: el slot {slot} tiene {len(options)} opciones pero "
                    f"{len(self.ingredient_amounts[slot])} cantidades."
                )

    @property
    def berry_percentage(self) -> float:
        """% de ayudas que dan baya = 100 − %ingrediente (clamp ≥ 0).

        La skill es independiente: una ayuda da baya o ingrediente y, además, puede
        disparar la skill, sin quitarle lugar a la baya. Por eso NO se resta el %skill.
        """
        return max(0.0, 100.0 - self.ingredient_percentage)

    @property
    def ingredient_slots(self) -> tuple[tuple[Ingredient, ...], ...]:
        """Opciones por slot, derivadas del orden de ``ingredients`` (prefijos).

        Siempre devuelve ``MAX_INGREDIENTS`` slots; si la especie tiene menos de
        ese número de ingredientes, los slots de más repiten el prefijo completo.
        """
        return tuple(self.ingredients[: i + 1] for i in range(MAX_INGREDIENTS))

    def allows_ingredient(self, slot: int, ingredient: Ingredient) -> bool:
        """¿Es ``ingredient`` válido para esta especie en ese slot?"""
        slots = self.ingredient_slots
        return 0 <= slot < len(slots) and ingredient in slots[slot]

    def ingredient_amount(self, slot: int, ingredient: Ingredient) -> int:
        """Cuántas unidades de ``ingredient`` produce una ayuda en ese slot."""
        options = self.ingredient_slots[slot]
        return self.ingredient_amounts[slot][options.index(ingredient)]


# Producción: además del set de ingredientes, cada especie fija sus datos del
# juego (frecuencia de ayuda base en segundos, % de ingrediente, % de skill, la
# matriz de cantidades por slot/ingrediente y el inventario base). Valores reales
# cruzados con nitoyon (pokesleep-tool), sleepapi/Neroli's Lab y Serebii.
# La matriz ``ingredient_amounts[slot][j]`` da las unidades de ``ingredient_slots
# [slot][j]`` (mismo ingrediente rinde más en slots altos; distintos ingredientes
# rinden distinto en el mismo slot).
SEED_SPECIES: tuple[Species, ...] = (
    Species(
        "Bulbasaur", 1, Specialty.INGREDIENTS, Berry.DURIN, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
        4400, 25.7, 1.9, ((2,), (5, 4), (7, 7, 6)), 11,
    ),
    Species(
        "Ivysaur", 2, Specialty.INGREDIENTS, Berry.DURIN, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
        3300, 25.5, 1.9, ((2,), (5, 4), (7, 7, 6)), 14,
    ),
    Species(
        "Charmander", 4, Specialty.BERRIES, Berry.LEPPA, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.WARMING_GINGER, I.FIERY_HERB),
        3500, 20.1, 1.1, ((2,), (5, 4), (7, 7, 6)), 12,
    ),
    Species(
        "Squirtle", 7, Specialty.INGREDIENTS, Berry.ORAN, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        4500, 27.1, 2.0, ((2,), (5, 3), (7, 5, 7)), 10,
    ),
    Species(
        "Caterpie", 10, Specialty.BERRIES, Berry.LUM, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS),
        4400, 17.9, 0.8, ((1,), (2, 2), (4, 3, 4)), 11,
    ),
    Species(
        "Pikachu", 25, Specialty.BERRIES, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        2700, 20.7, 2.1, ((1,), (2, 2), (4, 3, 3)), 17,
    ),
    Species(
        "Pichu", 172, Specialty.BERRIES, Berry.GREPA, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        4300, 21.0, 2.3, ((1,), (2, 2), (4, 3, 3)), 10,
    ),
    Species(
        # Set corregido (Serebii/sleepapi/nitoyon): Fancy Apple, Honey, Greengrass Soybeans.
        "Clefairy", 35, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        (I.FANCY_APPLE, I.HONEY, I.GREENGRASS_SOYBEANS),
        4000, 16.8, 3.6, ((1,), (2, 2), (4, 3, 3)), 16,
    ),
    Species(
        "Vulpix", 37, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO),
        4700, 16.8, 3.2, ((1,), (2, 2), (4, 3, 3)), 13,
    ),
    Species(
        # Set corregido: slot 3 es Greengrass Soybeans, no Soft Potato.
        "Diglett", 50, Specialty.INGREDIENTS, Berry.FIGY, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.LARGE_LEEK, I.GREENGRASS_SOYBEANS),
        4300, 19.2, 2.1, ((2,), (5, 3), (7, 4, 8)), 10,
    ),
    Species(
        # Orden corregido: Greengrass Soybeans, Soft Potato, Tasty Mushroom.
        "Geodude", 74, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.GREENGRASS_SOYBEANS, I.SOFT_POTATO, I.TASTY_MUSHROOM),
        5700, 28.1, 5.2, ((2,), (5, 4), (7, 6, 4)), 9,
    ),
    Species(
        "Slowpoke", 79, Specialty.SKILLS, Berry.ORAN, SleepType.DOZING,
        "Energizing Cheer S",
        (I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO),
        5700, 15.1, 7.8, ((1,), (2, 1), (4, 2, 5)), 9,
    ),
    Species(
        # Set corregido: Fiery Herb, Tasty Mushroom, Pure Oil (sin Bean Sausage).
        "Gastly", 92, Specialty.SKILLS, Berry.BLUK, SleepType.SLUMBERING,
        "Dream Shard Magnet S",
        (I.FIERY_HERB, I.TASTY_MUSHROOM, I.PURE_OIL),
        3800, 14.4, 1.5, ((2,), (5, 4), (7, 6, 8)), 10,
    ),
    Species(
        # Set corregido: slot 3 es Greengrass Soybeans, no Bean Sausage.
        "Kangaskhan", 115, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.WARMING_GINGER, I.SOFT_POTATO, I.GREENGRASS_SOYBEANS),
        2650, 22.2, 3.2, ((2,), (5, 4), (7, 6, 8)), 21,
    ),
    Species(
        "Eevee", 133, Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3700, 19.2, 5.5, ((1,), (2, 1), (4, 2, 3)), 12,
    ),
    Species(
        "Mareep", 179, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.FANCY_EGG),
        4600, 12.8, 4.7, ((1,), (2, 3), (4, 4)), 9,
    ),
)
