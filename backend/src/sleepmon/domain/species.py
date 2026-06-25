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


SEED_SPECIES: tuple[Species, ...] = (
    Species(
        "Bulbasaur", 1, Specialty.INGREDIENTS, Berry.DURIN, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
    ),
    Species(
        "Ivysaur", 2, Specialty.INGREDIENTS, Berry.DURIN, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
    ),
    Species(
        "Charmander", 4, Specialty.BERRIES, Berry.LEPPA, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.WARMING_GINGER, I.FIERY_HERB),
    ),
    Species(
        "Squirtle", 7, Specialty.INGREDIENTS, Berry.ORAN, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
    ),
    Species(
        "Caterpie", 10, Specialty.BERRIES, Berry.LUM, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS),
    ),
    Species(
        "Pikachu", 25, Specialty.BERRIES, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
    ),
    Species(
        "Pichu", 172, Specialty.BERRIES, Berry.GREPA, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
    ),
    Species(
        "Clefairy", 35, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        (I.FANCY_EGG, I.MOOMOO_MILK, I.SOOTHING_CACAO),
    ),
    Species(
        "Vulpix", 37, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO),
    ),
    Species(
        "Diglett", 50, Specialty.INGREDIENTS, Berry.FIGY, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.LARGE_LEEK, I.SOFT_POTATO),
    ),
    Species(
        "Geodude", 74, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM, I.SOFT_POTATO),
    ),
    Species(
        "Slowpoke", 79, Specialty.SKILLS, Berry.ORAN, SleepType.DOZING,
        "Energizing Cheer S",
        (I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO),
    ),
    Species(
        "Gastly", 92, Specialty.SKILLS, Berry.BLUK, SleepType.SLUMBERING,
        "Dream Shard Magnet S",
        (I.FIERY_HERB, I.BEAN_SAUSAGE, I.TASTY_MUSHROOM),
    ),
    Species(
        "Kangaskhan", 115, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.WARMING_GINGER, I.SOFT_POTATO, I.BEAN_SAUSAGE),
    ),
    Species(
        "Eevee", 133, Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
    ),
    Species(
        "Mareep", 179, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.FANCY_EGG),
    ),
)
