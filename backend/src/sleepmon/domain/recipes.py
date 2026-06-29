"""Catálogo de recetas (datos de referencia que viajan con el código).

Cada receta fija su tipo (curry/salad/dessert), los ingredientes requeridos con su
cantidad y su fuerza base. La fuerza efectiva de un plato es la base por el
multiplicador del nivel de la receta (``recipe_strength``).

Dataset completo del juego, sourceado de nitoyon (``pokesleep-tool``) y nerolis-lab
(sleepapi). Ampliarlo o corregirlo es agregar/editar entradas de ``SEED_RECIPES``.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.catalog_data import recipe_level_bonus
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741 — alias local para que el dataset se lea compacto


@dataclass(frozen=True, slots=True)
class Recipe:
    """Entrada del catálogo para una receta."""

    name: str
    type: RecipeType
    # Ingredientes requeridos con su cantidad, en orden de display del juego.
    ingredients: tuple[tuple[Ingredient, int], ...]
    base_strength: int  # fuerza base a nivel 1 (sin bonus)

    @property
    def total_ingredients(self) -> int:
        """Total de unidades de ingrediente que pide la receta."""
        return sum(count for _, count in self.ingredients)


def recipe_strength(recipe: Recipe, level: int) -> int:
    """Fuerza de ``recipe`` cocinada a nivel ``level`` (1..MAX_RECIPE_LEVEL)."""
    return round(recipe.base_strength * recipe_level_bonus(level))


SEED_RECIPES: tuple[Recipe, ...] = (
    # --- Curries y guisos ---
    Recipe("Fancy Apple Curry", RecipeType.CURRY, ((I.FANCY_APPLE, 7),), 748),
    Recipe("Simple Chowder", RecipeType.CURRY, ((I.MOOMOO_MILK, 7),), 814),
    Recipe("Mild Honey Curry", RecipeType.CURRY, ((I.HONEY, 7),), 839),
    Recipe("Beanburger Curry", RecipeType.CURRY, ((I.BEAN_SAUSAGE, 7),), 856),
    Recipe(
        "Hearty Cheeseburger Curry",
        RecipeType.CURRY,
        ((I.MOOMOO_MILK, 8), (I.BEAN_SAUSAGE, 8)),
        1910,
    ),
    Recipe(
        '"Drought" Katsu Curry',
        RecipeType.CURRY,
        ((I.BEAN_SAUSAGE, 10), (I.PURE_OIL, 5)),
        1942,
    ),
    Recipe(
        '"Solar Power" Tomato Curry',
        RecipeType.CURRY,
        ((I.SNOOZY_TOMATO, 10), (I.FIERY_HERB, 5)),
        2078,
    ),
    Recipe(
        "Melty Omelette Curry",
        RecipeType.CURRY,
        ((I.FANCY_EGG, 10), (I.SNOOZY_TOMATO, 6)),
        2150,
    ),
    Recipe(
        "Soft Potato Chowder",
        RecipeType.CURRY,
        ((I.MOOMOO_MILK, 10), (I.SOFT_POTATO, 8), (I.TASTY_MUSHROOM, 4)),
        3181,
    ),
    Recipe(
        '"Bulk Up" Bean Curry',
        RecipeType.CURRY,
        ((I.GREENGRASS_SOYBEANS, 12), (I.BEAN_SAUSAGE, 6), (I.FIERY_HERB, 4), (I.FANCY_EGG, 4)),
        3372,
    ),
    Recipe(
        '"Spore" Mushroom Curry',
        RecipeType.CURRY,
        ((I.TASTY_MUSHROOM, 14), (I.SOFT_POTATO, 9)),
        4162,
    ),
    Recipe(
        '"Egg Bomb" Curry',
        RecipeType.CURRY,
        ((I.HONEY, 12), (I.FANCY_APPLE, 11), (I.FANCY_EGG, 8), (I.SOFT_POTATO, 4)),
        4522,
    ),
    Recipe(
        '"Limber" Corn Stew',
        RecipeType.CURRY,
        ((I.GREENGRASS_CORN, 14), (I.MOOMOO_MILK, 8), (I.SOFT_POTATO, 8)),
        4670,
    ),
    Recipe(
        '"Dizzy Punch" Spicy Curry',
        RecipeType.CURRY,
        ((I.ROUSING_COFFEE, 11), (I.FIERY_HERB, 11), (I.HONEY, 11)),
        5702,
    ),
    Recipe(
        "Spicy Leek Curry",
        RecipeType.CURRY,
        ((I.LARGE_LEEK, 14), (I.WARMING_GINGER, 10), (I.FIERY_HERB, 8)),
        5900,
    ),
    Recipe(
        "Ninja Curry",
        RecipeType.CURRY,
        (
            (I.GREENGRASS_SOYBEANS, 24),
            (I.BEAN_SAUSAGE, 9),
            (I.LARGE_LEEK, 12),
            (I.TASTY_MUSHROOM, 5),
        ),
        9445,
    ),
    Recipe(
        "Grilled Tail Curry",
        RecipeType.CURRY,
        ((I.SLOWPOKE_TAIL, 8), (I.FIERY_HERB, 25)),
        7482,
    ),
    Recipe(
        '"Dream Eater" Butter Curry',
        RecipeType.CURRY,
        ((I.SOFT_POTATO, 18), (I.SNOOZY_TOMATO, 15), (I.SOOTHING_CACAO, 12), (I.MOOMOO_MILK, 10)),
        9010,
    ),
    Recipe(
        '"Inferno" Corn Keema Curry',
        RecipeType.CURRY,
        ((I.FIERY_HERB, 27), (I.BEAN_SAUSAGE, 24), (I.GREENGRASS_CORN, 14), (I.WARMING_GINGER, 12)),
        13690,
    ),
    Recipe(
        '"Hidden Power" Perk-Up Stew',
        RecipeType.CURRY,
        (
            (I.GREENGRASS_SOYBEANS, 28),
            (I.SNOOZY_TOMATO, 25),
            (I.TASTY_MUSHROOM, 23),
            (I.ROUSING_COFFEE, 16),
        ),
        19061,
    ),
    Recipe(
        '"Cut" Sukiyaki Curry',
        RecipeType.CURRY,
        ((I.LARGE_LEEK, 27), (I.BEAN_SAUSAGE, 26), (I.HONEY, 26), (I.FANCY_EGG, 22)),
        20655,
    ),
    Recipe(
        '"Role Play" Pumpkaboo Stew',
        RecipeType.CURRY,
        ((I.PLUMP_PUMPKIN, 10), (I.BEAN_SAUSAGE, 16), (I.SOFT_POTATO, 18), (I.TASTY_MUSHROOM, 25)),
        15621,
    ),
    Recipe(
        '"Overgrow" Avocado Gratin',
        RecipeType.CURRY,
        ((I.GLOSSY_AVOCADO, 22), (I.SOFT_POTATO, 20), (I.MOOMOO_MILK, 41), (I.PURE_OIL, 32)),
        24803,
    ),
    # --- Ensaladas ---
    Recipe("Fancy Apple Salad", RecipeType.SALAD, ((I.FANCY_APPLE, 8),), 855),
    Recipe("Bean Ham Salad", RecipeType.SALAD, ((I.BEAN_SAUSAGE, 8),), 978),
    Recipe("Snoozy Tomato Salad", RecipeType.SALAD, ((I.SNOOZY_TOMATO, 8),), 1045),
    Recipe(
        '"Snow Cloak" Caesar Salad',
        RecipeType.SALAD,
        ((I.MOOMOO_MILK, 10), (I.BEAN_SAUSAGE, 6)),
        1898,
    ),
    Recipe(
        '"Water Veil" Tofu Salad',
        RecipeType.SALAD,
        ((I.GREENGRASS_SOYBEANS, 15), (I.SNOOZY_TOMATO, 9)),
        3112,
    ),
    Recipe(
        '"Heat Wave" Tofu Salad',
        RecipeType.SALAD,
        ((I.GREENGRASS_SOYBEANS, 10), (I.FIERY_HERB, 6)),
        2114,
    ),
    Recipe(
        '"Dazzling" Apple Cheese Salad',
        RecipeType.SALAD,
        ((I.FANCY_APPLE, 15), (I.MOOMOO_MILK, 5), (I.PURE_OIL, 3)),
        2655,
    ),
    Recipe(
        '"Fury Attack" Corn Salad',
        RecipeType.SALAD,
        ((I.GREENGRASS_CORN, 9), (I.PURE_OIL, 8)),
        2785,
    ),
    Recipe(
        "Moomoo Caprese Salad",
        RecipeType.SALAD,
        ((I.MOOMOO_MILK, 12), (I.SNOOZY_TOMATO, 6), (I.PURE_OIL, 5)),
        2942,
    ),
    Recipe(
        '"Immunity" Leek Salad',
        RecipeType.SALAD,
        ((I.LARGE_LEEK, 10), (I.WARMING_GINGER, 5)),
        2845,
    ),
    Recipe(
        '"Superpower" Extreme Salad',
        RecipeType.SALAD,
        ((I.BEAN_SAUSAGE, 9), (I.WARMING_GINGER, 6), (I.FANCY_EGG, 5), (I.SOFT_POTATO, 3)),
        3046,
    ),
    Recipe(
        '"Contrary" Chocolate Meat Salad',
        RecipeType.SALAD,
        ((I.SOOTHING_CACAO, 14), (I.BEAN_SAUSAGE, 9)),
        3665,
    ),
    Recipe(
        '"Gluttony" Potato Salad',
        RecipeType.SALAD,
        ((I.SOFT_POTATO, 14), (I.FANCY_EGG, 9), (I.BEAN_SAUSAGE, 7), (I.FANCY_APPLE, 6)),
        5040,
    ),
    Recipe(
        '"Overheat" Ginger Salad',
        RecipeType.SALAD,
        ((I.FIERY_HERB, 17), (I.WARMING_GINGER, 10), (I.SNOOZY_TOMATO, 8)),
        5225,
    ),
    Recipe(
        '"Spore" Mushroom Salad',
        RecipeType.SALAD,
        ((I.TASTY_MUSHROOM, 17), (I.SNOOZY_TOMATO, 8), (I.PURE_OIL, 8)),
        5859,
    ),
    Recipe(
        '"Calm Mind" Fruit Salad',
        RecipeType.SALAD,
        ((I.FANCY_APPLE, 21), (I.HONEY, 16), (I.GREENGRASS_CORN, 12)),
        7675,
    ),
    Recipe(
        "Slowpoke Tail Pepper Salad",
        RecipeType.SALAD,
        ((I.SLOWPOKE_TAIL, 10), (I.FIERY_HERB, 10), (I.PURE_OIL, 15)),
        8169,
    ),
    Recipe(
        "Ninja Salad",
        RecipeType.SALAD,
        (
            (I.LARGE_LEEK, 15),
            (I.GREENGRASS_SOYBEANS, 19),
            (I.TASTY_MUSHROOM, 12),
            (I.WARMING_GINGER, 11),
        ),
        11659,
    ),
    Recipe(
        '"Cross Chop" Salad',
        RecipeType.SALAD,
        ((I.FANCY_EGG, 20), (I.BEAN_SAUSAGE, 15), (I.GREENGRASS_CORN, 11), (I.SNOOZY_TOMATO, 10)),
        8755,
    ),
    Recipe(
        "Greengrass Salad",
        RecipeType.SALAD,
        ((I.PURE_OIL, 22), (I.GREENGRASS_CORN, 17), (I.SNOOZY_TOMATO, 14), (I.SOFT_POTATO, 9)),
        11393,
    ),
    Recipe(
        '"Petal Blizzard" Layered Salad',
        RecipeType.SALAD,
        ((I.FANCY_EGG, 25), (I.PURE_OIL, 17), (I.SOFT_POTATO, 15), (I.BEAN_SAUSAGE, 12)),
        11881,
    ),
    Recipe(
        '"Apple Acid" Yogurt-Dressed Salad',
        RecipeType.SALAD,
        ((I.FANCY_EGG, 35), (I.FANCY_APPLE, 28), (I.SNOOZY_TOMATO, 23), (I.MOOMOO_MILK, 18)),
        19293,
    ),
    Recipe(
        '"Defiant" Coffee-Dressed Salad',
        RecipeType.SALAD,
        ((I.ROUSING_COFFEE, 28), (I.BEAN_SAUSAGE, 28), (I.PURE_OIL, 22), (I.SOFT_POTATO, 22)),
        20218,
    ),
    Recipe(
        "Luscious Avocado Salad",
        RecipeType.SALAD,
        ((I.GLOSSY_AVOCADO, 14), (I.GREENGRASS_SOYBEANS, 18), (I.PURE_OIL, 10)),
        7125,
    ),
    Recipe(
        '"Bulldoze" Guacamole and Chips',
        RecipeType.SALAD,
        (
            (I.GLOSSY_AVOCADO, 28),
            (I.GREENGRASS_CORN, 25),
            (I.FIERY_HERB, 30),
            (I.GREENGRASS_SOYBEANS, 22),
        ),
        25162,
    ),
    Recipe(
        '"Scald" Chunky Salad',
        RecipeType.SALAD,
        (
            (I.PLUMP_PUMPKIN, 20),
            (I.SOFT_POTATO, 30),
            (I.GREENGRASS_CORN, 18),
            (I.TASTY_MUSHROOM, 27),
        ),
        25356,
    ),
    # --- Postres y bebidas ---
    Recipe("Warm Moomoo Milk", RecipeType.DESSERT, ((I.MOOMOO_MILK, 7),), 814),
    Recipe("Fancy Apple Juice", RecipeType.DESSERT, ((I.FANCY_APPLE, 8),), 855),
    Recipe("Craft Soda Pop", RecipeType.DESSERT, ((I.HONEY, 9),), 1079),
    Recipe(
        '"Lucky Chant" Apple Pie',
        RecipeType.DESSERT,
        ((I.FANCY_APPLE, 12), (I.MOOMOO_MILK, 4)),
        1748,
    ),
    Recipe(
        '"Fluffy" Sweet Potatoes',
        RecipeType.DESSERT,
        ((I.SOFT_POTATO, 9), (I.MOOMOO_MILK, 5)),
        1907,
    ),
    Recipe(
        '"Ember" Ginger Tea',
        RecipeType.DESSERT,
        ((I.WARMING_GINGER, 9), (I.FANCY_APPLE, 7)),
        1913,
    ),
    Recipe(
        '"Cloud Nine" Soy Cake',
        RecipeType.DESSERT,
        ((I.FANCY_EGG, 8), (I.GREENGRASS_SOYBEANS, 7)),
        1924,
    ),
    Recipe(
        '"Stalwart" Vegetable Juice',
        RecipeType.DESSERT,
        ((I.SNOOZY_TOMATO, 9), (I.FANCY_APPLE, 7)),
        1924,
    ),
    Recipe(
        "Big Malasada",
        RecipeType.DESSERT,
        ((I.PURE_OIL, 10), (I.MOOMOO_MILK, 7), (I.HONEY, 6)),
        3015,
    ),
    Recipe(
        '"Hustle" Protein Smoothie',
        RecipeType.DESSERT,
        ((I.GREENGRASS_SOYBEANS, 15), (I.SOOTHING_CACAO, 8)),
        3263,
    ),
    Recipe(
        '"Huge Power" Soy Donuts',
        RecipeType.DESSERT,
        ((I.PURE_OIL, 12), (I.GREENGRASS_SOYBEANS, 16), (I.SOOTHING_CACAO, 7)),
        5547,
    ),
    Recipe(
        '"Sweet Scent" Chocolate Cake',
        RecipeType.DESSERT,
        ((I.HONEY, 9), (I.SOOTHING_CACAO, 8), (I.MOOMOO_MILK, 7)),
        3378,
    ),
    Recipe(
        '"Petal Dance" Chocolate Tart',
        RecipeType.DESSERT,
        ((I.FANCY_APPLE, 11), (I.SOOTHING_CACAO, 11)),
        3314,
    ),
    Recipe(
        '"Lovely Kiss" Smoothie',
        RecipeType.DESSERT,
        ((I.FANCY_APPLE, 11), (I.MOOMOO_MILK, 9), (I.HONEY, 7), (I.SOOTHING_CACAO, 8)),
        4734,
    ),
    Recipe(
        '"Steadfast" Ginger Cookies',
        RecipeType.DESSERT,
        ((I.HONEY, 14), (I.WARMING_GINGER, 12), (I.SOOTHING_CACAO, 5), (I.FANCY_EGG, 4)),
        4921,
    ),
    Recipe(
        "Neroli's Restorative Tea",
        RecipeType.DESSERT,
        ((I.WARMING_GINGER, 11), (I.FANCY_APPLE, 15), (I.TASTY_MUSHROOM, 9)),
        5065,
    ),
    Recipe(
        '"Explosion" Popcorn',
        RecipeType.DESSERT,
        ((I.GREENGRASS_CORN, 15), (I.PURE_OIL, 14), (I.MOOMOO_MILK, 7)),
        6048,
    ),
    Recipe(
        '"Early Bird" Coffee Jelly',
        RecipeType.DESSERT,
        ((I.ROUSING_COFFEE, 16), (I.MOOMOO_MILK, 14), (I.HONEY, 12)),
        6793,
    ),
    Recipe(
        '"Mold Breaker" Corn Tiramisu',
        RecipeType.DESSERT,
        ((I.ROUSING_COFFEE, 14), (I.GREENGRASS_CORN, 14), (I.MOOMOO_MILK, 12)),
        7125,
    ),
    Recipe(
        "Jigglypuff's Fruity Flan",
        RecipeType.DESSERT,
        ((I.HONEY, 20), (I.FANCY_EGG, 15), (I.MOOMOO_MILK, 10), (I.FANCY_APPLE, 10)),
        7594,
    ),
    Recipe(
        '"Teatime" Corn Scones',
        RecipeType.DESSERT,
        ((I.FANCY_APPLE, 20), (I.WARMING_GINGER, 20), (I.GREENGRASS_CORN, 18), (I.MOOMOO_MILK, 9)),
        10925,
    ),
    Recipe(
        '"Flower Gift" Macarons',
        RecipeType.DESSERT,
        ((I.SOOTHING_CACAO, 25), (I.FANCY_EGG, 25), (I.HONEY, 17), (I.MOOMOO_MILK, 10)),
        13834,
    ),
    Recipe(
        '"Zing Zap" Spiced Cola',
        RecipeType.DESSERT,
        ((I.FANCY_APPLE, 35), (I.WARMING_GINGER, 20), (I.LARGE_LEEK, 20), (I.ROUSING_COFFEE, 12)),
        17494,
    ),
    Recipe(
        "Clodsire Éclair",
        RecipeType.DESSERT,
        ((I.SOOTHING_CACAO, 30), (I.MOOMOO_MILK, 26), (I.ROUSING_COFFEE, 24), (I.HONEY, 22)),
        20885,
    ),
    Recipe(
        '"Honey Gather" Chocolate Waffles',
        RecipeType.DESSERT,
        ((I.HONEY, 38), (I.GREENGRASS_CORN, 28), (I.PURE_OIL, 28), (I.SOOTHING_CACAO, 21)),
        25484,
    ),
    Recipe(
        '"Scary Face" Pancakes',
        RecipeType.DESSERT,
        ((I.PLUMP_PUMPKIN, 18), (I.FANCY_EGG, 24), (I.HONEY, 32), (I.SNOOZY_TOMATO, 29)),
        24354,
    ),
    Recipe(
        '"Leaf Tornado" Smoothie',
        RecipeType.DESSERT,
        ((I.GLOSSY_AVOCADO, 18), (I.SNOOZY_TOMATO, 16), (I.MOOMOO_MILK, 14)),
        8165,
    ),
)
