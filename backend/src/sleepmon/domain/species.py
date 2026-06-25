"""Catálogo de especies (datos de referencia que viajan con el código).

Cada especie fija qué baya carga, su tipo de sueño, su main skill y —lo que usa la
validación— qué ingredientes son posibles en cada uno de los tres slots.

NOTA: este es un subconjunto **curado v1**, no las ~230 especies del juego, y los
sets de ingredientes por slot son la mejor aproximación disponible. Ampliarlo o
corregirlo es solo agregar/editar entradas de ``SEED_SPECIES`` — justamente el tipo
de dato que conviene auditar en bucle.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from sleepmon.domain.value_objects import Berry, Ingredient, SleepType, Specialty

I = Ingredient  # noqa: E741 — alias local para que el dataset se lea compacto


@dataclass(frozen=True, slots=True)
class Species:
    """Entrada del catálogo para una especie."""

    name: str
    specialty: Specialty
    berry: Berry
    sleep_type: SleepType
    main_skill: str
    # Un frozenset de ingredientes válidos por slot (0 = nivel 1, 1 = nivel 30,
    # 2 = nivel 60). Largo 3.
    ingredient_slots: tuple[frozenset[Ingredient], ...]

    def allows_ingredient(self, slot: int, ingredient: Ingredient) -> bool:
        """¿Es ``ingredient`` válido para esta especie en ese slot?"""
        return 0 <= slot < len(self.ingredient_slots) and ingredient in self.ingredient_slots[slot]


def _slots(*slots: Iterable[Ingredient]) -> tuple[frozenset[Ingredient], ...]:
    return tuple(frozenset(s) for s in slots)


SEED_SPECIES: tuple[Species, ...] = (
    Species(
        "Bulbasaur", Specialty.INGREDIENTS, Berry.DURIN, SleepType.SNOOZING,
        "Ingredient Magnet S",
        _slots({I.HONEY}, {I.HONEY, I.SNOOZY_TOMATO}, {I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO}),
    ),
    Species(
        "Ivysaur", Specialty.INGREDIENTS, Berry.DURIN, SleepType.SNOOZING,
        "Ingredient Magnet S",
        _slots({I.HONEY}, {I.HONEY, I.SNOOZY_TOMATO}, {I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO}),
    ),
    Species(
        "Charmander", Specialty.BERRIES, Berry.LEPPA, SleepType.SLUMBERING,
        "Charge Energy S",
        _slots({I.BEAN_SAUSAGE}, {I.BEAN_SAUSAGE, I.WARMING_GINGER},
               {I.BEAN_SAUSAGE, I.WARMING_GINGER, I.FIERY_HERB}),
    ),
    Species(
        "Squirtle", Specialty.INGREDIENTS, Berry.ORAN, SleepType.DOZING,
        "Ingredient Magnet S",
        _slots({I.MOOMOO_MILK}, {I.MOOMOO_MILK, I.SOOTHING_CACAO},
               {I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE}),
    ),
    Species(
        "Pikachu", Specialty.BERRIES, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength S",
        _slots({I.FANCY_APPLE}, {I.FANCY_APPLE, I.FANCY_EGG, I.WARMING_GINGER},
               {I.FANCY_APPLE, I.FANCY_EGG, I.WARMING_GINGER}),
    ),
    Species(
        "Pichu", Specialty.BERRIES, Berry.GREPA, SleepType.SLUMBERING,
        "Charge Strength S",
        _slots({I.FANCY_APPLE}, {I.FANCY_APPLE, I.FANCY_EGG, I.WARMING_GINGER},
               {I.FANCY_APPLE, I.FANCY_EGG, I.WARMING_GINGER}),
    ),
    Species(
        "Gastly", Specialty.SKILLS, Berry.BLUK, SleepType.SLUMBERING,
        "Dream Shard Magnet S",
        _slots({I.FIERY_HERB}, {I.FIERY_HERB, I.BEAN_SAUSAGE},
               {I.FIERY_HERB, I.BEAN_SAUSAGE, I.TASTY_MUSHROOM}),
    ),
    Species(
        "Caterpie", Specialty.BERRIES, Berry.LUM, SleepType.DOZING,
        "Ingredient Magnet S",
        _slots({I.HONEY}, {I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS},
               {I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS}),
    ),
    Species(
        "Diglett", Specialty.INGREDIENTS, Berry.FIGY, SleepType.DOZING,
        "Ingredient Magnet S",
        _slots({I.SNOOZY_TOMATO}, {I.SNOOZY_TOMATO, I.LARGE_LEEK},
               {I.SNOOZY_TOMATO, I.LARGE_LEEK, I.SOFT_POTATO}),
    ),
    Species(
        "Slowpoke", Specialty.SKILLS, Berry.ORAN, SleepType.DOZING,
        "Energizing Cheer S",
        _slots({I.SOOTHING_CACAO}, {I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO},
               {I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO}),
    ),
    Species(
        "Clefairy", Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        _slots({I.FANCY_EGG}, {I.FANCY_EGG, I.MOOMOO_MILK},
               {I.FANCY_EGG, I.MOOMOO_MILK, I.SOOTHING_CACAO}),
    ),
    Species(
        "Vulpix", Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Energizing Cheer S",
        _slots({I.GREENGRASS_SOYBEANS}, {I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO},
               {I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO}),
    ),
    Species(
        "Geodude", Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength S",
        _slots({I.GREENGRASS_SOYBEANS}, {I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM, I.SOFT_POTATO},
               {I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM, I.SOFT_POTATO}),
    ),
    Species(
        "Mareep", Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength M",
        _slots({I.FIERY_HERB}, {I.FIERY_HERB, I.FANCY_EGG}, {I.FIERY_HERB, I.FANCY_EGG}),
    ),
    Species(
        "Kangaskhan", Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        _slots({I.WARMING_GINGER}, {I.WARMING_GINGER, I.SOFT_POTATO},
               {I.WARMING_GINGER, I.SOFT_POTATO, I.BEAN_SAUSAGE}),
    ),
    Species(
        "Eevee", Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        _slots({I.MOOMOO_MILK}, {I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE},
               {I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE}),
    ),
)
