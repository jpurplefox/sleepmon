"""Catálogo de especies (datos de referencia que viajan con el código).

Cada especie fija su número de Pokédex, qué baya carga, su tipo de sueño, su main
skill y —lo que usa la validación— qué ingredientes son posibles en cada slot.

Dataset completo del juego: 230 especies/formas. Generado desde nitoyon
(``pokesleep-tool``, ``src/data/pokemon.json``: sleep type, especialidad, skill,
frecuencia, %ingrediente/%skill, ingredientes con cantidades por slot, inventario
base y ``evolutionCount`` -> ``evolution_stage``)
y cruzado/validado contra nerolis-lab (sleepapi) para la baya por tipo y la
especialidad/skill de cada especie. La baya sale del tipo del Pokémon (bijección
fija del juego). Ampliarlo o corregirlo es solo agregar/editar entradas de
``SEED_SPECIES``.

Se omiten Mew y Darkrai (los dos especialistas "All"): usan un mecanismo
"Versatile"/comodín y el juego no publica sus cantidades de ingrediente por slot,
así que no se pueden cargar con datos reales en el modelo de 3 ingredientes
ordenados.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.catalog_data import (
    INVENTORY_BONUS_PER_EVOLUTION,
    MAX_EVOLUTION_STAGE,
    MAX_INGREDIENTS,
    SKILL_PITY_HELPS,
    SKILL_SPECIALIST_PITY_SECONDS,
)
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
    base_inventory: int  # carry limit de la forma SIN evolucionar (sin nivel ni sub skills)
    # Cuántas veces evolucionó la especie respecto a su forma base: 0 = base,
    # 1 = primera evolución, 2 = segunda. Sube el carry limit (ver ``carry_limit``).
    # Las formas que no evolucionan (legendarios, especiales, eventos) son 0.
    evolution_stage: int = 0
    # Evoluciones TOTALES de la línea (0/1/2): cuántas veces puede evolucionar desde
    # la forma base. Es constante en toda la línea (Bulbasaur, Ivysaur y Venusaur
    # valen 2) y define el bonus de velocidad del listón. Las formas que no
    # evolucionan son 0.
    line_evolutions: int = 0

    def __post_init__(self) -> None:
        if not 0 <= self.evolution_stage <= MAX_EVOLUTION_STAGE:
            raise ValueError(
                f"{self.name}: evolution_stage debe estar entre 0 y {MAX_EVOLUTION_STAGE}."
            )
        if not self.evolution_stage <= self.line_evolutions <= MAX_EVOLUTION_STAGE:
            raise ValueError(
                f"{self.name}: line_evolutions ({self.line_evolutions}) debe estar entre "
                f"evolution_stage ({self.evolution_stage}) y {MAX_EVOLUTION_STAGE}."
            )
        if len(self.ingredient_amounts) != MAX_INGREDIENTS:
            raise ValueError(f"{self.name}: ingredient_amounts debe tener {MAX_INGREDIENTS} slots.")
        for slot, options in enumerate(self.ingredient_slots):
            if len(self.ingredient_amounts[slot]) != len(options):
                raise ValueError(
                    f"{self.name}: el slot {slot} tiene {len(options)} opciones pero "
                    f"{len(self.ingredient_amounts[slot])} cantidades."
                )

    @property
    def carry_limit(self) -> int:
        """Carry limit base ya con el bonus de evolución (+5 por evolución), sin sub skills.

        ``base_inventory`` es el de la forma sin evolucionar; cada evolución suma
        ``INVENTORY_BONUS_PER_EVOLUTION``. Es el inventario base que usa la producción.
        """
        return self.base_inventory + INVENTORY_BONUS_PER_EVOLUTION * self.evolution_stage

    @property
    def pity_helps(self) -> int:
        """Ayudas seguidas sin disparar la skill tras las que se fuerza (pity proc).

        No especialistas en skill: umbral fijo (``SKILL_PITY_HELPS``). Especialistas en
        SKILL: umbral propio derivado de la frecuencia base —el juego fuerza la skill
        tras ~``SKILL_SPECIALIST_PITY_SECONDS`` de tiempo base, así que en ayudas es
        ``SKILL_SPECIALIST_PITY_SECONDS / frecuencia_base`` (los rápidos toleran más
        ayudas; los lentos, menos). Se calcula sobre la frecuencia base de nivel 1: la
        velocidad real (energía, nivel, sub skills) no cambia cuántas ayudas hacen
        falta, solo el tiempo en completarlas.
        """
        if self.specialty is Specialty.SKILLS:
            return round(SKILL_SPECIALIST_PITY_SECONDS / self.help_frequency_seconds)
        return SKILL_PITY_HELPS

    @property
    def evolutions_remaining(self) -> int:
        """Cuántas veces puede evolucionar TODAVÍA (0/1/2): las que le quedan a esta forma.

        Es ``line_evolutions − evolution_stage``: Bulbasaur puede 2, Ivysaur 1 y
        Venusaur 0. Define si el listón da bonus de velocidad (una forma totalmente
        evolucionada no lo recibe).
        """
        return self.line_evolutions - self.evolution_stage

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


# Producción: además del set de ingredientes, cada especie fija sus datos del juego
# (frecuencia de ayuda base en segundos, % de ingrediente, % de skill, la matriz de
# cantidades por slot/ingrediente y el inventario base). La matriz
# ``ingredient_amounts[slot][j]`` da las unidades de ``ingredient_slots[slot][j]``
# (mismo ingrediente rinde más en slots altos; distintos ingredientes rinden distinto
# en el mismo slot).
SEED_SPECIES: tuple[Species, ...] = (
    Species(
        "Bulbasaur", 1, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
        4400, 25.7, 1.9, ((2,), (5, 4), (7, 7, 6)), 11, 0, 2,
    ),
    Species(
        "Ivysaur", 2, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
        3300, 25.5, 1.9, ((2,), (5, 4), (7, 7, 6)), 14, 1, 2,
    ),
    Species(
        "Venusaur", 3, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO),
        2800, 26.6, 2.1, ((2,), (5, 4), (7, 7, 6)), 17, 2, 2,
    ),
    Species(
        "Charmander", 4, Specialty.INGREDIENTS, Berry.LEPPA, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.BEAN_SAUSAGE, I.WARMING_GINGER, I.FIERY_HERB),
        3500, 20.1, 1.1, ((2,), (5, 4), (7, 7, 6)), 12, 0, 2,
    ),
    Species(
        "Charmeleon", 5, Specialty.INGREDIENTS, Berry.LEPPA, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.BEAN_SAUSAGE, I.WARMING_GINGER, I.FIERY_HERB),
        3000, 22.7, 1.6, ((2,), (5, 4), (7, 7, 6)), 15, 1, 2,
    ),
    Species(
        "Charizard", 6, Specialty.INGREDIENTS, Berry.LEPPA, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.BEAN_SAUSAGE, I.WARMING_GINGER, I.FIERY_HERB),
        2400, 22.4, 1.6, ((2,), (5, 4), (7, 7, 6)), 19, 2, 2,
    ),
    Species(
        "Squirtle", 7, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        4500, 27.1, 2, ((2,), (5, 3), (7, 5, 7)), 10, 0, 2,
    ),
    Species(
        "Wartortle", 8, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3400, 27.1, 2, ((2,), (5, 3), (7, 5, 7)), 14, 1, 2,
    ),
    Species(
        "Blastoise", 9, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        2800, 27.5, 2.1, ((2,), (5, 3), (7, 5, 7)), 17, 2, 2,
    ),
    Species(
        "Caterpie", 10, Specialty.BERRIES, Berry.LUM, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS),
        4400, 17.9, 0.8, ((1,), (2, 2), (4, 3, 4)), 11, 0, 2,
    ),
    Species(
        "Metapod", 11, Specialty.BERRIES, Berry.LUM, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS),
        4200, 20.8, 1.8, ((1,), (2, 2), (4, 3, 4)), 13, 1, 2,
    ),
    Species(
        "Butterfree", 12, Specialty.BERRIES, Berry.LUM, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.HONEY, I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS),
        2500, 19.7, 1.4, ((1,), (2, 2), (4, 3, 4)), 21, 2, 2,
    ),
    Species(
        "Rattata", 19, Specialty.BERRIES, Berry.PERSIM, SleepType.SNOOZING,
        "Charge Energy S",
        (I.FANCY_APPLE, I.GREENGRASS_SOYBEANS, I.BEAN_SAUSAGE),
        4900, 23.7, 3, ((1,), (2, 2), (4, 3, 3)), 10, 0, 1,
    ),
    Species(
        "Raticate", 20, Specialty.BERRIES, Berry.PERSIM, SleepType.SNOOZING,
        "Charge Energy S",
        (I.FANCY_APPLE, I.GREENGRASS_SOYBEANS, I.BEAN_SAUSAGE),
        2950, 23.7, 3, ((1,), (2, 2), (4, 3, 3)), 16, 1, 1,
    ),
    Species(
        "Ekans", 23, Specialty.BERRIES, Berry.CHESTO, SleepType.DOZING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.FANCY_EGG, I.FIERY_HERB),
        5000, 23.5, 3.3, ((1,), (2, 2), (4, 3, 3)), 10, 0, 1,
    ),
    Species(
        "Arbok", 24, Specialty.BERRIES, Berry.CHESTO, SleepType.DOZING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.FANCY_EGG, I.FIERY_HERB),
        3400, 26.4, 5.7, ((1,), (2, 2), (4, 3, 3)), 14, 1, 1,
    ),
    Species(
        "Pikachu", 25, Specialty.BERRIES, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        2700, 20.7, 2.1, ((1,), (2, 2), (4, 3, 3)), 17, 1, 2,
    ),
    Species(
        "Pikachu (Holiday)", 25, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Dream Shard Magnet S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        2500, 13.1, 4.2, ((1,), (2, 2), (4, 3, 3)), 20,
    ),
    Species(
        "Pikachu (Halloween)", 25, Specialty.BERRIES, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength S (Random)",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        2500, 21.8, 2.8, ((1,), (2, 2), (4, 3, 3)), 18,
    ),
    Species(
        "Raichu", 26, Specialty.BERRIES, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        2200, 22.4, 3.2, ((1,), (2, 2), (4, 3, 3)), 21, 2, 2,
    ),
    Species(
        "Sandshrew", 27, Specialty.SKILLS, Berry.FIGY, SleepType.SLUMBERING,
        "Ingredient Draw S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_CORN, I.SOFT_POTATO),
        5300, 10.0, 4.6, ((1,), (2, 4), (4, 6, 7)), 11, 0, 1,
    ),
    Species(
        "Sandslash", 28, Specialty.SKILLS, Berry.FIGY, SleepType.SLUMBERING,
        "Ingredient Draw S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_CORN, I.SOFT_POTATO),
        2800, 10.8, 4.3, ((1,), (2, 4), (4, 6, 7)), 17, 1, 1,
    ),
    Species(
        "Clefairy", 35, Specialty.BERRIES, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        (I.FANCY_APPLE, I.HONEY, I.GREENGRASS_SOYBEANS),
        4000, 16.8, 3.6, ((1,), (2, 2), (4, 3, 3)), 16, 1, 2,
    ),
    Species(
        "Clefable", 36, Specialty.BERRIES, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        (I.FANCY_APPLE, I.HONEY, I.GREENGRASS_SOYBEANS),
        2800, 16.8, 3.6, ((1,), (2, 2), (4, 3, 3)), 24, 2, 2,
    ),
    Species(
        "Vulpix", 37, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO),
        4700, 16.8, 3.2, ((1,), (2, 2), (4, 3, 3)), 13, 0, 1,
    ),
    Species(
        "Vulpix (Alola)", 37, Specialty.BERRIES, Berry.RAWST, SleepType.SLUMBERING,
        "Extra Helpful S",
        (I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO),
        5600, 23, 2.8, ((1,), (2, 2), (4, 3, 3)), 10, 0, 1,
    ),
    Species(
        "Ninetales", 38, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO),
        2600, 16.4, 2.9, ((1,), (2, 2), (4, 3, 3)), 23, 1, 1,
    ),
    Species(
        "Ninetales (Alola)", 38, Specialty.BERRIES, Berry.RAWST, SleepType.SLUMBERING,
        "Extra Helpful S",
        (I.GREENGRASS_SOYBEANS, I.GREENGRASS_CORN, I.SOFT_POTATO),
        2900, 23.2, 2.8, ((1,), (2, 2), (4, 3, 3)), 20, 1, 1,
    ),
    Species(
        "Jigglypuff", 39, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.HONEY, I.PURE_OIL, I.SOOTHING_CACAO),
        3900, 18.2, 4.3, ((1,), (2, 2), (4, 3, 2)), 9, 1, 2,
    ),
    Species(
        "Wigglytuff", 40, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.HONEY, I.PURE_OIL, I.SOOTHING_CACAO),
        2750, 19.1, 4, ((1,), (2, 2), (4, 3, 2)), 22, 2, 2,
    ),
    Species(
        "Diglett", 50, Specialty.INGREDIENTS, Berry.FIGY, SleepType.SNOOZING,
        "Charge Strength S",
        (I.SNOOZY_TOMATO, I.LARGE_LEEK, I.GREENGRASS_SOYBEANS),
        4300, 19.2, 2.1, ((2,), (5, 3), (7, 4, 8)), 10, 0, 1,
    ),
    Species(
        "Dugtrio", 51, Specialty.INGREDIENTS, Berry.FIGY, SleepType.SNOOZING,
        "Charge Strength S",
        (I.SNOOZY_TOMATO, I.LARGE_LEEK, I.GREENGRASS_SOYBEANS),
        2650, 19, 2, ((2,), (5, 3), (7, 4, 8)), 16, 1, 1,
    ),
    Species(
        "Meowth", 52, Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Dream Shard Magnet S",
        (I.MOOMOO_MILK, I.BEAN_SAUSAGE),
        4400, 16.3, 4.2, ((1,), (2, 2), (4, 3)), 9, 0, 1,
    ),
    Species(
        "Persian", 53, Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Dream Shard Magnet S",
        (I.MOOMOO_MILK, I.BEAN_SAUSAGE),
        2800, 16.9, 4.4, ((1,), (2, 2), (4, 3)), 12, 1, 1,
    ),
    Species(
        "Psyduck", 54, Specialty.SKILLS, Berry.ORAN, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.SOOTHING_CACAO, I.FANCY_APPLE, I.BEAN_SAUSAGE),
        5400, 13.6, 12.6, ((1,), (2, 4), (4, 6, 5)), 8, 0, 1,
    ),
    Species(
        "Golduck", 55, Specialty.SKILLS, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.SOOTHING_CACAO, I.FANCY_APPLE, I.BEAN_SAUSAGE),
        3400, 16.2, 12.5, ((1,), (2, 4), (4, 6, 5)), 14, 1, 1,
    ),
    Species(
        "Mankey", 56, Specialty.BERRIES, Berry.CHERI, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.BEAN_SAUSAGE, I.TASTY_MUSHROOM, I.HONEY),
        4200, 19.7, 2.2, ((1,), (2, 1), (4, 2, 4)), 12, 0, 1,
    ),
    Species(
        "Primeape", 57, Specialty.BERRIES, Berry.CHERI, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.BEAN_SAUSAGE, I.TASTY_MUSHROOM, I.HONEY),
        2800, 20, 2.4, ((1,), (2, 1), (4, 2, 4)), 17, 1, 1,
    ),
    Species(
        "Growlithe", 58, Specialty.SKILLS, Berry.LEPPA, SleepType.SNOOZING,
        "Extra Helpful S",
        (I.FIERY_HERB, I.BEAN_SAUSAGE, I.MOOMOO_MILK),
        4300, 13.8, 5, ((1,), (2, 3), (4, 5, 5)), 8, 0, 1,
    ),
    Species(
        "Arcanine", 59, Specialty.SKILLS, Berry.LEPPA, SleepType.SNOOZING,
        "Extra Helpful S",
        (I.FIERY_HERB, I.BEAN_SAUSAGE, I.MOOMOO_MILK),
        2500, 13.6, 4.9, ((1,), (2, 3), (4, 5, 5)), 16, 1, 1,
    ),
    Species(
        "Bellsprout", 69, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Charge Energy S",
        (I.SNOOZY_TOMATO, I.SOFT_POTATO, I.LARGE_LEEK),
        5200, 23.3, 3.9, ((2,), (5, 4), (7, 6, 4)), 8, 0, 2,
    ),
    Species(
        "Weepinbell", 70, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Charge Energy S",
        (I.SNOOZY_TOMATO, I.SOFT_POTATO, I.LARGE_LEEK),
        3800, 23.5, 4, ((2,), (5, 4), (7, 6, 4)), 12, 1, 2,
    ),
    Species(
        "Victreebel", 71, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Charge Energy S",
        (I.SNOOZY_TOMATO, I.SOFT_POTATO, I.LARGE_LEEK),
        2800, 23.3, 3.9, ((2,), (5, 4), (7, 6, 4)), 17, 2, 2,
    ),
    Species(
        "Geodude", 74, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.GREENGRASS_SOYBEANS, I.SOFT_POTATO, I.TASTY_MUSHROOM),
        5700, 28.1, 5.2, ((2,), (5, 4), (7, 6, 4)), 9, 0, 2,
    ),
    Species(
        "Graveler", 75, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.GREENGRASS_SOYBEANS, I.SOFT_POTATO, I.TASTY_MUSHROOM),
        4000, 27.2, 4.8, ((2,), (5, 4), (7, 6, 4)), 12, 1, 2,
    ),
    Species(
        "Golem", 76, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.GREENGRASS_SOYBEANS, I.SOFT_POTATO, I.TASTY_MUSHROOM),
        3100, 28, 5.2, ((2,), (5, 4), (7, 6, 4)), 16, 2, 2,
    ),
    Species(
        "Slowpoke", 79, Specialty.SKILLS, Berry.ORAN, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO),
        5700, 15.1, 7.8, ((1,), (2, 1), (4, 2, 5)), 9, 0, 1,
    ),
    Species(
        "Slowbro", 80, Specialty.SKILLS, Berry.ORAN, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO),
        3800, 19.7, 8, ((1,), (2, 1), (4, 2, 5)), 16, 1, 1,
    ),
    Species(
        "Magnemite", 81, Specialty.SKILLS, Berry.BELUE, SleepType.SLUMBERING,
        "Cooking Power-Up S",
        (I.PURE_OIL, I.FIERY_HERB),
        5800, 18.2, 6.4, ((1,), (2, 2), (4, 3)), 8, 0, 2,
    ),
    Species(
        "Magneton", 82, Specialty.SKILLS, Berry.BELUE, SleepType.SLUMBERING,
        "Cooking Power-Up S",
        (I.PURE_OIL, I.FIERY_HERB),
        4000, 18.2, 6.3, ((1,), (2, 2), (4, 3)), 11, 1, 2,
    ),
    Species(
        "Farfetch'd", 83, Specialty.INGREDIENTS, Berry.PAMTRE, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.LARGE_LEEK, I.BEAN_SAUSAGE, I.WARMING_GINGER),
        3000, 16, 4.3, ((2,), (5, 8), (7, 13, 12)), 18,
    ),
    Species(
        "Doduo", 84, Specialty.BERRIES, Berry.PAMTRE, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.GREENGRASS_SOYBEANS, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3800, 18.4, 2, ((1,), (2, 1), (4, 2, 3)), 13, 0, 1,
    ),
    Species(
        "Dodrio", 85, Specialty.BERRIES, Berry.PAMTRE, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.GREENGRASS_SOYBEANS, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        2300, 18.4, 2, ((1,), (2, 1), (4, 2, 3)), 21, 1, 1,
    ),
    Species(
        "Gastly", 92, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.FIERY_HERB, I.TASTY_MUSHROOM, I.PURE_OIL),
        3800, 14.4, 1.5, ((2,), (5, 4), (7, 6, 8)), 10, 0, 2,
    ),
    Species(
        "Haunter", 93, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.FIERY_HERB, I.TASTY_MUSHROOM, I.PURE_OIL),
        3000, 15.7, 2.2, ((2,), (5, 4), (7, 6, 8)), 14, 1, 2,
    ),
    Species(
        "Gengar", 94, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.FIERY_HERB, I.TASTY_MUSHROOM, I.PURE_OIL),
        2200, 16.1, 2.4, ((2,), (5, 4), (7, 6, 8)), 18, 2, 2,
    ),
    Species(
        "Onix", 95, Specialty.BERRIES, Berry.SITRUS, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.BEAN_SAUSAGE, I.SOFT_POTATO),
        3100, 13.2, 2.3, ((1,), (2, 2), (4, 4, 3)), 22, 0, 1,
    ),
    Species(
        "Cubone", 104, Specialty.BERRIES, Berry.FIGY, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.WARMING_GINGER, I.SOOTHING_CACAO),
        4800, 22.3, 4.4, ((1,), (2, 2), (4, 3)), 10, 0, 1,
    ),
    Species(
        "Marowak", 105, Specialty.BERRIES, Berry.FIGY, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.WARMING_GINGER, I.SOOTHING_CACAO),
        3300, 22.5, 4.5, ((1,), (2, 2), (4, 3)), 15, 1, 1,
    ),
    Species(
        "Chansey", 113, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.FANCY_EGG, I.SOFT_POTATO, I.HONEY),
        3300, 23.6, 2.3, ((2,), (5, 4), (7, 7, 8)), 15, 1, 2,
    ),
    Species(
        "Kangaskhan", 115, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.WARMING_GINGER, I.SOFT_POTATO, I.GREENGRASS_SOYBEANS),
        2650, 22.2, 3.2, ((2,), (5, 4), (7, 6, 8)), 21,
    ),
    Species(
        "Mr. Mime", 122, Specialty.INGREDIENTS, Berry.MAGO, SleepType.SNOOZING,
        "Skill Copy (Mimic)",
        (I.SNOOZY_TOMATO, I.SOFT_POTATO, I.LARGE_LEEK),
        2800, 21.6, 3.9, ((2,), (5, 4), (7, 6, 4)), 17, 1, 1,
    ),
    Species(
        "Pinsir", 127, Specialty.INGREDIENTS, Berry.LUM, SleepType.DOZING,
        "Charge Strength M",
        (I.HONEY, I.FANCY_APPLE, I.BEAN_SAUSAGE),
        2400, 21.6, 3.1, ((2,), (5, 5), (7, 8, 7)), 24,
    ),
    Species(
        "Ditto", 132, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Skill Copy (Transform)",
        (I.PURE_OIL, I.LARGE_LEEK, I.SLOWPOKE_TAIL),
        3500, 20.1, 3.6, ((2,), (5, 3), (7, 5, 3)), 17,
    ),
    Species(
        "Eevee", 133, Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3700, 19.2, 5.5, ((1,), (2, 1), (4, 2, 3)), 12, 0, 1,
    ),
    Species(
        "Eevee (Halloween)", 133, Specialty.SKILLS, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.PLUMP_PUMPKIN, I.SOOTHING_CACAO, I.MOOMOO_MILK),
        3200, 12, 4.6, ((1,), (2, 4), (4, 6, 9)), 18,
    ),
    Species(
        "Eevee (Holiday)", 133, Specialty.BERRIES, Berry.PERSIM, SleepType.SNOOZING,
        "Dream Shard Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3100, 15.6, 3.2, ((1,), (2, 1), (4, 2, 3)), 20,
    ),
    Species(
        "Vaporeon", 134, Specialty.SKILLS, Berry.ORAN, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3100, 21.2, 6.1, ((1,), (2, 1), (4, 2, 3)), 13, 1, 1,
    ),
    Species(
        "Jolteon", 135, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Extra Helpful S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        2200, 15.1, 3.9, ((1,), (2, 1), (4, 2, 3)), 17, 1, 1,
    ),
    Species(
        "Flareon", 136, Specialty.SKILLS, Berry.LEPPA, SleepType.SNOOZING,
        "Cooking Power-Up S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        2700, 18.5, 5.2, ((1,), (2, 1), (4, 2, 3)), 14, 1, 1,
    ),
    Species(
        "Dratini", 147, Specialty.INGREDIENTS, Berry.YACHE, SleepType.DOZING,
        "Charge Energy S",
        (I.FIERY_HERB, I.GREENGRASS_CORN, I.PURE_OIL),
        5000, 25, 2, ((2,), (5, 4), (7, 7, 8)), 9, 0, 2,
    ),
    Species(
        "Dragonair", 148, Specialty.INGREDIENTS, Berry.YACHE, SleepType.DOZING,
        "Charge Energy S",
        (I.FIERY_HERB, I.GREENGRASS_CORN, I.PURE_OIL),
        3800, 26.2, 2.5, ((2,), (5, 4), (7, 7, 8)), 12, 1, 2,
    ),
    Species(
        "Dragonite", 149, Specialty.INGREDIENTS, Berry.YACHE, SleepType.DOZING,
        "Charge Energy S",
        (I.FIERY_HERB, I.GREENGRASS_CORN, I.PURE_OIL),
        2600, 26.4, 2.6, ((2,), (5, 4), (7, 7, 8)), 20, 2, 2,
    ),
    Species(
        "Chikorita", 152, Specialty.BERRIES, Berry.DURIN, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.SOOTHING_CACAO, I.HONEY, I.LARGE_LEEK),
        4400, 16.9, 3.9, ((1,), (2, 3), (4, 5, 3)), 12, 0, 2,
    ),
    Species(
        "Bayleef", 153, Specialty.BERRIES, Berry.DURIN, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.SOOTHING_CACAO, I.HONEY, I.LARGE_LEEK),
        3300, 16.8, 3.8, ((1,), (2, 3), (4, 5, 3)), 17, 1, 2,
    ),
    Species(
        "Meganium", 154, Specialty.BERRIES, Berry.DURIN, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.SOOTHING_CACAO, I.HONEY, I.LARGE_LEEK),
        2800, 17.5, 4.6, ((1,), (2, 3), (4, 5, 3)), 20, 2, 2,
    ),
    Species(
        "Cyndaquil", 155, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Charge Strength S (Random)",
        (I.WARMING_GINGER, I.FIERY_HERB, I.PURE_OIL),
        3500, 18.6, 2.1, ((1,), (2, 2), (4, 3, 3)), 14, 0, 2,
    ),
    Species(
        "Quilava", 156, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Charge Strength S (Random)",
        (I.WARMING_GINGER, I.FIERY_HERB, I.PURE_OIL),
        3000, 21.1, 4.1, ((1,), (2, 2), (4, 3, 3)), 18, 1, 2,
    ),
    Species(
        "Typhlosion", 157, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Charge Strength S (Random)",
        (I.WARMING_GINGER, I.FIERY_HERB, I.PURE_OIL),
        2400, 20.8, 3.9, ((1,), (2, 2), (4, 3, 3)), 23, 2, 2,
    ),
    Species(
        "Totodile", 158, Specialty.BERRIES, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.BEAN_SAUSAGE, I.PURE_OIL),
        4500, 25.3, 5.2, ((1,), (2, 2), (4, 3)), 11, 0, 2,
    ),
    Species(
        "Croconaw", 159, Specialty.BERRIES, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.BEAN_SAUSAGE, I.PURE_OIL),
        3400, 25.3, 5.2, ((1,), (2, 2), (4, 3)), 15, 1, 2,
    ),
    Species(
        "Feraligatr", 160, Specialty.BERRIES, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.BEAN_SAUSAGE, I.PURE_OIL),
        2800, 25.7, 5.5, ((1,), (2, 2), (4, 3)), 19, 2, 2,
    ),
    Species(
        "Pichu", 172, Specialty.BERRIES, Berry.GREPA, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG),
        4300, 21, 2.3, ((1,), (2, 2), (4, 3, 3)), 10, 0, 2,
    ),
    Species(
        "Cleffa", 173, Specialty.BERRIES, Berry.PECHA, SleepType.SLUMBERING,
        "Metronome",
        (I.FANCY_APPLE, I.HONEY, I.GREENGRASS_SOYBEANS),
        5600, 16.4, 3.4, ((1,), (2, 2), (4, 3, 3)), 10, 0, 2,
    ),
    Species(
        "Igglybuff", 174, Specialty.SKILLS, Berry.PECHA, SleepType.SLUMBERING,
        "Energy for Everyone S",
        (I.HONEY, I.PURE_OIL, I.SOOTHING_CACAO),
        5200, 17, 3.8, ((1,), (2, 2), (4, 3, 2)), 8, 0, 2,
    ),
    Species(
        "Togepi", 175, Specialty.SKILLS, Berry.PECHA, SleepType.SLUMBERING,
        "Metronome",
        (I.FANCY_EGG, I.WARMING_GINGER, I.SOOTHING_CACAO),
        4800, 15.1, 4.9, ((1,), (2, 2), (4, 4, 3)), 8, 0, 2,
    ),
    Species(
        "Togetic", 176, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        (I.FANCY_EGG, I.WARMING_GINGER, I.SOOTHING_CACAO),
        3800, 16.3, 5.6, ((1,), (2, 2), (4, 4, 3)), 10, 1, 2,
    ),
    Species(
        "Natu", 177, Specialty.BERRIES, Berry.MAGO, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.FANCY_EGG, I.SOOTHING_CACAO, I.FANCY_APPLE),
        4500, 18.5, 1.6, ((1,), (2, 2), (4, 3, 5)), 11, 0, 1,
    ),
    Species(
        "Xatu", 178, Specialty.BERRIES, Berry.MAGO, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.FANCY_EGG, I.SOOTHING_CACAO, I.FANCY_APPLE),
        2500, 19.1, 2.5, ((1,), (2, 2), (4, 3, 5)), 19, 1, 1,
    ),
    Species(
        "Mareep", 179, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.FANCY_EGG),
        4600, 12.8, 4.7, ((1,), (2, 3), (4, 4)), 9, 0, 2,
    ),
    Species(
        "Flaaffy", 180, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.FANCY_EGG),
        3300, 12.7, 4.6, ((1,), (2, 3), (4, 4)), 11, 1, 2,
    ),
    Species(
        "Ampharos", 181, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.FANCY_EGG),
        2500, 13, 4.7, ((1,), (2, 3), (4, 4)), 15, 2, 2,
    ),
    Species(
        "Sudowoodo", 185, Specialty.SKILLS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength M",
        (I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM),
        4000, 21.7, 7.2, ((1,), (2, 2), (4, 4, 2)), 16, 1, 1,
    ),
    Species(
        "Wooper", 194, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.TASTY_MUSHROOM, I.SOFT_POTATO, I.BEAN_SAUSAGE),
        5900, 20.1, 3.8, ((2,), (5, 6), (7, 10, 12)), 10, 0, 1,
    ),
    Species(
        "Wooper (Paldea)", 194, Specialty.INGREDIENTS, Berry.CHESTO, SleepType.DOZING,
        "Charge Energy S",
        (I.SOOTHING_CACAO, I.ROUSING_COFFEE, I.SOFT_POTATO),
        6400, 20.9, 5.6, ((2,), (5, 4), (7, 7, 9)), 9, 0, 1,
    ),
    Species(
        "Quagsire", 195, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.TASTY_MUSHROOM, I.SOFT_POTATO, I.BEAN_SAUSAGE),
        3400, 19, 3.2, ((2,), (5, 6), (7, 10, 12)), 16, 1, 1,
    ),
    Species(
        "Espeon", 196, Specialty.SKILLS, Berry.MAGO, SleepType.SNOOZING,
        "Charge Strength M",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        2400, 16.4, 4.4, ((1,), (2, 1), (4, 2, 3)), 16, 1, 1,
    ),
    Species(
        "Umbreon", 197, Specialty.SKILLS, Berry.WIKI, SleepType.DOZING,
        "Charge Energy S (Moonlight)",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3200, 21.9, 10.1, ((1,), (2, 1), (4, 2, 3)), 14, 1, 1,
    ),
    Species(
        "Murkrow", 198, Specialty.SKILLS, Berry.WIKI, SleepType.DOZING,
        "Ingredient Draw S (Super Luck)",
        (I.ROUSING_COFFEE, I.GREENGRASS_SOYBEANS, I.FIERY_HERB),
        3600, 14.1, 6.2, ((1,), (2, 3), (4, 6, 4)), 13, 0, 1,
    ),
    Species(
        "Slowking", 199, Specialty.SKILLS, Berry.ORAN, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.SOOTHING_CACAO, I.SLOWPOKE_TAIL, I.SNOOZY_TOMATO),
        3400, 16.6, 8.7, ((1,), (2, 1), (4, 2, 5)), 17, 1, 1,
    ),
    Species(
        "Wobbuffet", 202, Specialty.SKILLS, Berry.MAGO, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.FANCY_APPLE, I.TASTY_MUSHROOM, I.PURE_OIL),
        3500, 21.1, 8.2, ((1,), (2, 1), (4, 2, 3)), 16, 1, 1,
    ),
    Species(
        "Steelix", 208, Specialty.BERRIES, Berry.BELUE, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.BEAN_SAUSAGE, I.SOFT_POTATO),
        3000, 15.4, 3.2, ((1,), (2, 2), (4, 4, 3)), 25, 1, 1,
    ),
    Species(
        "Shuckle", 213, Specialty.SKILLS, Berry.LUM, SleepType.DOZING,
        "Energy for Everyone S (Berry Juice)",
        (I.PURE_OIL, I.ROUSING_COFFEE, I.HONEY),
        3600, 20.5, 5.9, ((1,), (2, 2), (4, 3, 4)), 16,
    ),
    Species(
        "Heracross", 214, Specialty.SKILLS, Berry.LUM, SleepType.DOZING,
        "Cooking Assist S (Bulk Up)",
        (I.HONEY, I.TASTY_MUSHROOM, I.BEAN_SAUSAGE),
        2300, 15.8, 4.7, ((1,), (2, 1), (4, 2, 4)), 20,
    ),
    Species(
        "Sneasel", 215, Specialty.BERRIES, Berry.WIKI, SleepType.DOZING,
        "Tasty Chance S",
        (I.BEAN_SAUSAGE, I.FANCY_EGG, I.GREENGRASS_SOYBEANS),
        3200, 25.5, 1.9, ((1,), (2, 2), (4, 3, 4)), 17, 0, 1,
    ),
    Species(
        "Delibird", 225, Specialty.INGREDIENTS, Berry.PAMTRE, SleepType.DOZING,
        "Ingredient Magnet S (Present)",
        (I.FANCY_EGG, I.FANCY_APPLE, I.SOOTHING_CACAO),
        2500, 18.8, 3, ((2,), (5, 6), (7, 9, 5)), 20,
    ),
    Species(
        "Houndour", 228, Specialty.BERRIES, Berry.WIKI, SleepType.DOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.WARMING_GINGER, I.LARGE_LEEK),
        4900, 20.1, 3.7, ((1,), (2, 3), (4, 4, 3)), 10, 0, 1,
    ),
    Species(
        "Houndoom", 229, Specialty.BERRIES, Berry.WIKI, SleepType.DOZING,
        "Charge Strength M",
        (I.FIERY_HERB, I.WARMING_GINGER, I.LARGE_LEEK),
        3300, 20.3, 4, ((1,), (2, 3), (4, 4, 3)), 16, 1, 1,
    ),
    Species(
        "Blissey", 242, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.FANCY_EGG, I.SOFT_POTATO, I.HONEY),
        3100, 23.8, 2.3, ((2,), (5, 4), (7, 7, 8)), 21, 2, 2,
    ),
    Species(
        "Raikou", 243, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Helper Boost",
        (I.BEAN_SAUSAGE, I.FIERY_HERB, I.LARGE_LEEK),
        2100, 19.2, 1.9, ((1,), (2, 2), (4, 3, 2)), 22,
    ),
    Species(
        "Entei", 244, Specialty.SKILLS, Berry.LEPPA, SleepType.SNOOZING,
        "Helper Boost",
        (I.PURE_OIL, I.SNOOZY_TOMATO, I.TASTY_MUSHROOM),
        2400, 18.7, 2.3, ((1,), (2, 2), (4, 4, 3)), 19,
    ),
    Species(
        "Suicune", 245, Specialty.SKILLS, Berry.ORAN, SleepType.SLUMBERING,
        "Helper Boost",
        (I.FANCY_APPLE, I.PURE_OIL, I.GREENGRASS_CORN),
        2700, 27.7, 2.6, ((1,), (2, 2), (4, 3, 2)), 17,
    ),
    Species(
        "Larvitar", 246, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.WARMING_GINGER, I.GREENGRASS_SOYBEANS, I.BEAN_SAUSAGE),
        4800, 23.8, 4.1, ((2,), (5, 5), (7, 8, 8)), 9, 0, 2,
    ),
    Species(
        "Pupitar", 247, Specialty.INGREDIENTS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.WARMING_GINGER, I.GREENGRASS_SOYBEANS, I.BEAN_SAUSAGE),
        3600, 24.7, 4.5, ((2,), (5, 5), (7, 8, 8)), 13, 1, 2,
    ),
    Species(
        "Tyranitar", 248, Specialty.INGREDIENTS, Berry.WIKI, SleepType.DOZING,
        "Charge Energy S",
        (I.WARMING_GINGER, I.GREENGRASS_SOYBEANS, I.BEAN_SAUSAGE),
        2700, 26.6, 5.2, ((2,), (5, 5), (7, 8, 8)), 19, 2, 2,
    ),
    Species(
        "Treecko", 252, Specialty.SKILLS, Berry.DURIN, SleepType.DOZING,
        "Berry Burst",
        (I.FANCY_EGG, I.ROUSING_COFFEE, I.LARGE_LEEK),
        4500, 17.2, 3.5, ((1,), (2, 2), (4, 3, 2)), 8, 0, 2,
    ),
    Species(
        "Grovyle", 253, Specialty.SKILLS, Berry.DURIN, SleepType.DOZING,
        "Berry Burst",
        (I.FANCY_EGG, I.ROUSING_COFFEE, I.LARGE_LEEK),
        3300, 15, 3.5, ((1,), (2, 2), (4, 3, 2)), 11, 1, 2,
    ),
    Species(
        "Sceptile", 254, Specialty.SKILLS, Berry.DURIN, SleepType.DOZING,
        "Berry Burst",
        (I.FANCY_EGG, I.ROUSING_COFFEE, I.LARGE_LEEK),
        2300, 10.7, 3, ((1,), (2, 2), (4, 3, 2)), 17, 2, 2,
    ),
    Species(
        "Torchic", 255, Specialty.BERRIES, Berry.LEPPA, SleepType.SNOOZING,
        "Charge Energy S",
        (I.TASTY_MUSHROOM, I.GREENGRASS_SOYBEANS, I.PURE_OIL),
        4300, 16, 4.4, ((1,), (2, 4), (4, 6, 5)), 12, 0, 2,
    ),
    Species(
        "Combusken", 256, Specialty.BERRIES, Berry.CHERI, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.TASTY_MUSHROOM, I.GREENGRASS_SOYBEANS, I.PURE_OIL),
        3400, 17, 5.2, ((1,), (2, 4), (4, 6, 5)), 16, 1, 2,
    ),
    Species(
        "Blaziken", 257, Specialty.BERRIES, Berry.CHERI, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.TASTY_MUSHROOM, I.GREENGRASS_SOYBEANS, I.PURE_OIL),
        2600, 15.3, 4.9, ((1,), (2, 4), (4, 6, 5)), 22, 2, 2,
    ),
    Species(
        "Mudkip", 258, Specialty.BERRIES, Berry.ORAN, SleepType.SLUMBERING,
        "Tasty Chance S",
        (I.GREENGRASS_CORN, I.MOOMOO_MILK, I.TASTY_MUSHROOM),
        4700, 19.2, 2.4, ((1,), (2, 3), (4, 5, 3)), 11, 0, 2,
    ),
    Species(
        "Marshtomp", 259, Specialty.BERRIES, Berry.FIGY, SleepType.SLUMBERING,
        "Tasty Chance S",
        (I.GREENGRASS_CORN, I.MOOMOO_MILK, I.TASTY_MUSHROOM),
        3500, 16.8, 2.8, ((1,), (2, 3), (4, 5, 3)), 16, 1, 2,
    ),
    Species(
        "Swampert", 260, Specialty.BERRIES, Berry.FIGY, SleepType.SLUMBERING,
        "Tasty Chance S",
        (I.GREENGRASS_CORN, I.MOOMOO_MILK, I.TASTY_MUSHROOM),
        2800, 14.6, 3.4, ((1,), (2, 3), (4, 5, 3)), 20, 2, 2,
    ),
    Species(
        "Ralts", 280, Specialty.SKILLS, Berry.MAGO, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.FANCY_APPLE, I.GREENGRASS_CORN, I.LARGE_LEEK),
        4800, 14.5, 4.3, ((1,), (2, 1), (4, 2, 2)), 9, 0, 2,
    ),
    Species(
        "Kirlia", 281, Specialty.SKILLS, Berry.MAGO, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.FANCY_APPLE, I.GREENGRASS_CORN, I.LARGE_LEEK),
        3500, 14.6, 4.3, ((1,), (2, 1), (4, 2, 2)), 13, 1, 2,
    ),
    Species(
        "Gardevoir", 282, Specialty.SKILLS, Berry.MAGO, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.FANCY_APPLE, I.GREENGRASS_CORN, I.LARGE_LEEK),
        2400, 14.4, 4.2, ((1,), (2, 1), (4, 2, 2)), 18, 2, 2,
    ),
    Species(
        "Slakoth", 287, Specialty.BERRIES, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.HONEY, I.FANCY_APPLE),
        4900, 21.6, 1.9, ((1,), (2, 2), (4, 4, 4)), 7, 0, 2,
    ),
    Species(
        "Vigoroth", 288, Specialty.BERRIES, Berry.PERSIM, SleepType.DOZING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.HONEY, I.FANCY_APPLE),
        3200, 20.4, 1.5, ((1,), (2, 2), (4, 4, 4)), 9, 1, 2,
    ),
    Species(
        "Slaking", 289, Specialty.BERRIES, Berry.PERSIM, SleepType.SNOOZING,
        "Ingredient Magnet S",
        (I.SNOOZY_TOMATO, I.HONEY, I.FANCY_APPLE),
        3600, 33.9, 6.7, ((1,), (2, 2), (4, 4, 4)), 16, 2, 2,
    ),
    Species(
        "Sableye", 302, Specialty.SKILLS, Berry.WIKI, SleepType.DOZING,
        "Dream Shard Magnet S (Random)",
        (I.PURE_OIL, I.TASTY_MUSHROOM, I.SOOTHING_CACAO),
        3600, 18.8, 6.8, ((1,), (2, 2), (4, 3, 3)), 16,
    ),
    Species(
        "Mawile", 303, Specialty.INGREDIENTS, Berry.BELUE, SleepType.SLUMBERING,
        "Ingredient Draw S (Hyper Cutter)",
        (I.PURE_OIL, I.GREENGRASS_CORN, I.SNOOZY_TOMATO),
        3200, 20.4, 3.8, ((2,), (5, 4), (7, 6, 8)), 17,
    ),
    Species(
        "Aron", 304, Specialty.INGREDIENTS, Berry.BELUE, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.ROUSING_COFFEE, I.GREENGRASS_SOYBEANS),
        5700, 27.3, 4.6, ((2,), (5, 3), (7, 5, 7)), 10, 0, 2,
    ),
    Species(
        "Lairon", 305, Specialty.INGREDIENTS, Berry.BELUE, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.ROUSING_COFFEE, I.GREENGRASS_SOYBEANS),
        4200, 27.7, 4.8, ((2,), (5, 3), (7, 5, 7)), 13, 1, 2,
    ),
    Species(
        "Aggron", 306, Specialty.INGREDIENTS, Berry.BELUE, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.BEAN_SAUSAGE, I.ROUSING_COFFEE, I.GREENGRASS_SOYBEANS),
        3000, 28.5, 5.2, ((2,), (5, 3), (7, 5, 7)), 18, 2, 2,
    ),
    Species(
        "Plusle", 311, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Ingredient Magnet S (Plus)",
        (I.ROUSING_COFFEE, I.LARGE_LEEK, I.MOOMOO_MILK),
        2400, 10.3, 4.9, ((1,), (2, 2), (4, 3, 6)), 16,
    ),
    Species(
        "Minun", 312, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Cooking Power-Up S (Minus)",
        (I.HONEY, I.FANCY_EGG, I.MOOMOO_MILK),
        2400, 17.4, 4.9, ((1,), (2, 2), (4, 3, 4)), 16,
    ),
    Species(
        "Gulpin", 316, Specialty.SKILLS, Berry.CHESTO, SleepType.DOZING,
        "Dream Shard Magnet S (Random)",
        (I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM, I.HONEY),
        5900, 21.4, 6.3, ((1,), (2, 1), (4, 2, 4)), 8, 0, 1,
    ),
    Species(
        "Swalot", 317, Specialty.SKILLS, Berry.CHESTO, SleepType.DOZING,
        "Dream Shard Magnet S (Random)",
        (I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM, I.HONEY),
        3500, 21, 7, ((1,), (2, 1), (4, 2, 4)), 19, 1, 1,
    ),
    Species(
        "Trapinch", 328, Specialty.INGREDIENTS, Berry.FIGY, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.GLOSSY_AVOCADO, I.FIERY_HERB, I.GREENGRASS_SOYBEANS),
        5000, 15.2, 3.1, ((2,), (5, 6), (7, 9, 12)), 8, 0, 2,
    ),
    Species(
        "Vibrava", 329, Specialty.INGREDIENTS, Berry.FIGY, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.GLOSSY_AVOCADO, I.FIERY_HERB, I.GREENGRASS_SOYBEANS),
        3700, 15.5, 3.4, ((2,), (5, 6), (7, 9, 12)), 12, 1, 2,
    ),
    Species(
        "Flygon", 330, Specialty.INGREDIENTS, Berry.FIGY, SleepType.SLUMBERING,
        "Charge Strength S",
        (I.GLOSSY_AVOCADO, I.FIERY_HERB, I.GREENGRASS_SOYBEANS),
        2700, 17.2, 3.9, ((2,), (5, 6), (7, 9, 12)), 17, 2, 2,
    ),
    Species(
        "Swablu", 333, Specialty.BERRIES, Berry.PAMTRE, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.FANCY_EGG, I.GREENGRASS_SOYBEANS, I.FANCY_APPLE),
        4200, 17.7, 3.2, ((1,), (2, 3), (4, 4, 5)), 12, 0, 1,
    ),
    Species(
        "Altaria", 334, Specialty.BERRIES, Berry.YACHE, SleepType.DOZING,
        "Charge Energy S",
        (I.FANCY_EGG, I.GREENGRASS_SOYBEANS, I.FANCY_APPLE),
        3500, 25.8, 6.1, ((1,), (2, 3), (4, 4, 5)), 14, 1, 1,
    ),
    Species(
        "Shuppet", 353, Specialty.BERRIES, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.PURE_OIL, I.WARMING_GINGER, I.TASTY_MUSHROOM),
        3900, 17.1, 2.6, ((1,), (2, 2), (4, 4, 3)), 11, 0, 1,
    ),
    Species(
        "Banette", 354, Specialty.BERRIES, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Random)",
        (I.PURE_OIL, I.WARMING_GINGER, I.TASTY_MUSHROOM),
        2600, 17.9, 3.3, ((1,), (2, 2), (4, 4, 3)), 19, 1, 1,
    ),
    Species(
        "Absol", 359, Specialty.INGREDIENTS, Berry.WIKI, SleepType.DOZING,
        "Charge Strength M",
        (I.SOOTHING_CACAO, I.FANCY_APPLE, I.TASTY_MUSHROOM),
        2950, 17.8, 3.8, ((2,), (5, 8), (7, 12, 7)), 21,
    ),
    Species(
        "Wynaut", 360, Specialty.SKILLS, Berry.MAGO, SleepType.SLUMBERING,
        "Energizing Cheer S",
        (I.FANCY_APPLE, I.TASTY_MUSHROOM, I.PURE_OIL),
        5800, 21.3, 6.9, ((1,), (2, 1), (4, 2, 3)), 7, 0, 1,
    ),
    Species(
        "Spheal", 363, Specialty.BERRIES, Berry.RAWST, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.PURE_OIL, I.BEAN_SAUSAGE, I.WARMING_GINGER),
        5600, 22.4, 2.3, ((1,), (2, 3), (4, 4, 4)), 9, 0, 2,
    ),
    Species(
        "Spheal (Holiday)", 363, Specialty.SKILLS, Berry.RAWST, SleepType.SLUMBERING,
        "Tasty Chance S",
        (I.PURE_OIL, I.BEAN_SAUSAGE, I.WARMING_GINGER),
        3300, 21.4, 5, ((1,), (2, 3), (4, 4, 4)), 20,
    ),
    Species(
        "Sealeo", 364, Specialty.BERRIES, Berry.RAWST, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.PURE_OIL, I.BEAN_SAUSAGE, I.WARMING_GINGER),
        4000, 22.1, 2.1, ((1,), (2, 3), (4, 4, 4)), 13, 1, 2,
    ),
    Species(
        "Walrein", 365, Specialty.BERRIES, Berry.RAWST, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.PURE_OIL, I.BEAN_SAUSAGE, I.WARMING_GINGER),
        3000, 22.3, 2.2, ((1,), (2, 3), (4, 4, 4)), 18, 2, 2,
    ),
    Species(
        "Bagon", 371, Specialty.BERRIES, Berry.YACHE, SleepType.DOZING,
        "Cooking Power-Up S",
        (I.SOFT_POTATO, I.WARMING_GINGER, I.BEAN_SAUSAGE),
        5300, 20.9, 2.7, ((1,), (2, 3), (4, 4, 4)), 9, 0, 2,
    ),
    Species(
        "Shelgon", 372, Specialty.BERRIES, Berry.YACHE, SleepType.DOZING,
        "Cooking Power-Up S",
        (I.SOFT_POTATO, I.WARMING_GINGER, I.BEAN_SAUSAGE),
        3800, 20.6, 2.7, ((1,), (2, 3), (4, 4, 4)), 14, 1, 2,
    ),
    Species(
        "Salamence", 373, Specialty.BERRIES, Berry.YACHE, SleepType.DOZING,
        "Cooking Power-Up S",
        (I.SOFT_POTATO, I.WARMING_GINGER, I.BEAN_SAUSAGE),
        2800, 21.7, 3.4, ((1,), (2, 3), (4, 4, 4)), 22, 2, 2,
    ),
    Species(
        "Latias", 380, Specialty.SKILLS, Berry.YACHE, SleepType.DOZING,
        "Energizing Cheer S (Heal Pulse)",
        (I.SNOOZY_TOMATO, I.PLUMP_PUMPKIN, I.TASTY_MUSHROOM),
        2800, 11.4, 4.9, ((1,), (2, 1), (4, 2, 2)), 19,
    ),
    Species(
        "Latios", 381, Specialty.SKILLS, Berry.YACHE, SleepType.DOZING,
        "Berry Burst (Draco Meteor)",
        (I.SNOOZY_TOMATO, I.FANCY_EGG, I.MOOMOO_MILK),
        2800, 19.8, 3, ((1,), (2, 2), (4, 3, 4)), 19,
    ),
    Species(
        "Shinx", 403, Specialty.INGREDIENTS, Berry.GREPA, SleepType.SNOOZING,
        "Cooking Power-Up S",
        (I.SNOOZY_TOMATO, I.PURE_OIL, I.ROUSING_COFFEE),
        4400, 18.1, 1.8, ((2,), (5, 4), (7, 7, 5)), 11, 0, 2,
    ),
    Species(
        "Luxio", 404, Specialty.INGREDIENTS, Berry.GREPA, SleepType.SNOOZING,
        "Cooking Power-Up S",
        (I.SNOOZY_TOMATO, I.PURE_OIL, I.ROUSING_COFFEE),
        3200, 18.2, 1.8, ((2,), (5, 4), (7, 7, 5)), 16, 1, 2,
    ),
    Species(
        "Luxray", 405, Specialty.INGREDIENTS, Berry.GREPA, SleepType.SNOOZING,
        "Cooking Power-Up S",
        (I.SNOOZY_TOMATO, I.PURE_OIL, I.ROUSING_COFFEE),
        2400, 20, 2.3, ((2,), (5, 4), (7, 7, 5)), 21, 2, 2,
    ),
    Species(
        "Drifloon", 425, Specialty.SKILLS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Stockpile)",
        (I.GREENGRASS_CORN, I.PURE_OIL, I.SOFT_POTATO),
        4800, 13.7, 7.1, ((1,), (2, 3), (4, 4, 4)), 9, 0, 1,
    ),
    Species(
        "Drifblim", 426, Specialty.SKILLS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S (Stockpile)",
        (I.GREENGRASS_CORN, I.PURE_OIL, I.SOFT_POTATO),
        2500, 12.8, 6.3, ((1,), (2, 3), (4, 4, 4)), 17, 1, 1,
    ),
    Species(
        "Honchkrow", 430, Specialty.SKILLS, Berry.WIKI, SleepType.DOZING,
        "Ingredient Draw S (Super Luck)",
        (I.ROUSING_COFFEE, I.GREENGRASS_SOYBEANS, I.FIERY_HERB),
        3200, 14.3, 6.7, ((1,), (2, 3), (4, 6, 4)), 18, 1, 1,
    ),
    Species(
        "Bonsly", 438, Specialty.SKILLS, Berry.SITRUS, SleepType.SLUMBERING,
        "Charge Strength M",
        (I.SNOOZY_TOMATO, I.GREENGRASS_SOYBEANS, I.TASTY_MUSHROOM),
        6300, 18.9, 6.1, ((1,), (2, 2), (4, 4, 2)), 8, 0, 1,
    ),
    Species(
        "Mime Jr.", 439, Specialty.INGREDIENTS, Berry.MAGO, SleepType.SLUMBERING,
        "Skill Copy (Mimic)",
        (I.SNOOZY_TOMATO, I.SOFT_POTATO, I.LARGE_LEEK),
        4300, 20.1, 3.2, ((2,), (5, 4), (7, 6, 4)), 10, 0, 1,
    ),
    Species(
        "Happiny", 440, Specialty.INGREDIENTS, Berry.PERSIM, SleepType.SLUMBERING,
        "Energy for Everyone S",
        (I.FANCY_EGG, I.SOFT_POTATO, I.HONEY),
        5400, 21, 1.3, ((2,), (5, 4), (7, 7, 8)), 7, 0, 2,
    ),
    Species(
        "Spiritomb", 442, Specialty.INGREDIENTS, Berry.WIKI, SleepType.DOZING,
        "Extra Helpful S",
        (I.TASTY_MUSHROOM, I.PLUMP_PUMPKIN, I.LARGE_LEEK),
        3500, 19.8, 3.6, ((2,), (5, 3), (7, 5, 6)), 27,
    ),
    Species(
        "Riolu", 447, Specialty.SKILLS, Berry.CHERI, SleepType.SLUMBERING,
        "Dream Shard Magnet S",
        (I.PURE_OIL, I.SOFT_POTATO, I.FANCY_EGG),
        4200, 12.6, 3.8, ((1,), (2, 2), (4, 4, 4)), 9, 0, 1,
    ),
    Species(
        "Lucario", 448, Specialty.SKILLS, Berry.CHERI, SleepType.SLUMBERING,
        "Dream Shard Magnet S",
        (I.PURE_OIL, I.SOFT_POTATO, I.FANCY_EGG),
        2600, 15, 5.1, ((1,), (2, 2), (4, 4, 4)), 14, 1, 1,
    ),
    Species(
        "Croagunk", 453, Specialty.INGREDIENTS, Berry.CHESTO, SleepType.DOZING,
        "Charge Strength S",
        (I.PURE_OIL, I.BEAN_SAUSAGE),
        5600, 22.8, 4.2, ((2,), (5, 5), (7, 8)), 10, 0, 1,
    ),
    Species(
        "Toxicroak", 454, Specialty.INGREDIENTS, Berry.CHESTO, SleepType.DOZING,
        "Charge Strength S",
        (I.PURE_OIL, I.BEAN_SAUSAGE),
        3400, 22.9, 4.3, ((2,), (5, 5), (7, 8)), 14, 1, 1,
    ),
    Species(
        "Snover", 459, Specialty.INGREDIENTS, Berry.RAWST, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.SNOOZY_TOMATO, I.FANCY_EGG, I.TASTY_MUSHROOM),
        5600, 25.1, 4.4, ((2,), (5, 4), (7, 7, 5)), 10, 0, 1,
    ),
    Species(
        "Abomasnow", 460, Specialty.INGREDIENTS, Berry.RAWST, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.SNOOZY_TOMATO, I.FANCY_EGG, I.TASTY_MUSHROOM),
        3000, 25, 4.4, ((2,), (5, 4), (7, 7, 5)), 21, 1, 1,
    ),
    Species(
        "Weavile", 461, Specialty.BERRIES, Berry.WIKI, SleepType.DOZING,
        "Tasty Chance S",
        (I.BEAN_SAUSAGE, I.FANCY_EGG, I.GREENGRASS_SOYBEANS),
        2700, 25.1, 1.8, ((1,), (2, 2), (4, 3, 4)), 21, 1, 1,
    ),
    Species(
        "Magnezone", 462, Specialty.SKILLS, Berry.BELUE, SleepType.SLUMBERING,
        "Cooking Power-Up S",
        (I.PURE_OIL, I.FIERY_HERB),
        3100, 17.9, 6.2, ((1,), (2, 2), (4, 3)), 13, 2, 2,
    ),
    Species(
        "Togekiss", 468, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Metronome",
        (I.FANCY_EGG, I.WARMING_GINGER, I.SOOTHING_CACAO),
        2600, 15.8, 5.3, ((1,), (2, 2), (4, 4, 3)), 16, 2, 2,
    ),
    Species(
        "Leafeon", 470, Specialty.SKILLS, Berry.DURIN, SleepType.DOZING,
        "Energizing Cheer S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3000, 20.5, 6.9, ((1,), (2, 1), (4, 2, 3)), 13, 1, 1,
    ),
    Species(
        "Glaceon", 471, Specialty.SKILLS, Berry.RAWST, SleepType.SLUMBERING,
        "Cooking Power-Up S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        3200, 21.9, 6.3, ((1,), (2, 1), (4, 2, 3)), 12, 1, 1,
    ),
    Species(
        "Gallade", 475, Specialty.SKILLS, Berry.CHERI, SleepType.SLUMBERING,
        "Extra Helpful S",
        (I.FANCY_APPLE, I.GREENGRASS_CORN, I.LARGE_LEEK),
        2400, 14.7, 5.4, ((1,), (2, 1), (4, 2, 2)), 19, 2, 2,
    ),
    Species(
        "Cresselia", 488, Specialty.SKILLS, Berry.MAGO, SleepType.SNOOZING,
        "Energy for Everyone S (Lunar Blessing)",
        (I.WARMING_GINGER, I.SOOTHING_CACAO, I.SNOOZY_TOMATO),
        2300, 23.9, 4.1, ((1,), (2, 2), (4, 3, 4)), 22,
    ),
    Species(
        "Munna", 517, Specialty.BERRIES, Berry.MAGO, SleepType.SNOOZING,
        "Dream Shard Magnet S (Random)",
        (I.MOOMOO_MILK, I.HONEY, I.ROUSING_COFFEE),
        5700, 19.7, 4.3, ((1,), (2, 2), (4, 3, 2)), 12, 0, 1,
    ),
    Species(
        "Musharna", 518, Specialty.BERRIES, Berry.MAGO, SleepType.SNOOZING,
        "Dream Shard Magnet S (Random)",
        (I.MOOMOO_MILK, I.HONEY, I.ROUSING_COFFEE),
        2800, 18.8, 4.1, ((1,), (2, 2), (4, 3, 2)), 24, 1, 1,
    ),
    Species(
        "Dwebble", 557, Specialty.SKILLS, Berry.LUM, SleepType.DOZING,
        "Ingredient Draw S",
        (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL),
        4300, 17.5, 5.4, ((1,), (2, 3), (4, 5, 5)), 8, 0, 1,
    ),
    Species(
        "Crustle", 558, Specialty.SKILLS, Berry.LUM, SleepType.DOZING,
        "Ingredient Draw S",
        (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL),
        3200, 23.9, 6.4, ((1,), (2, 3), (4, 5, 5)), 17, 1, 1,
    ),
    Species(
        "Rufflet", 627, Specialty.SKILLS, Berry.PAMTRE, SleepType.SLUMBERING,
        "Berry Burst",
        (I.BEAN_SAUSAGE, I.GREENGRASS_CORN, I.ROUSING_COFFEE),
        3800, 12.5, 3.1, ((1,), (2, 2), (4, 3, 2)), 10, 0, 1,
    ),
    Species(
        "Braviary", 628, Specialty.SKILLS, Berry.PAMTRE, SleepType.SLUMBERING,
        "Berry Burst",
        (I.BEAN_SAUSAGE, I.GREENGRASS_CORN, I.ROUSING_COFFEE),
        2400, 12.1, 3.5, ((1,), (2, 2), (4, 3, 2)), 18, 1, 1,
    ),
    Species(
        "Tyrunt", 696, Specialty.BERRIES, Berry.SITRUS, SleepType.SLUMBERING,
        "Cooking Power-Up S",
        (I.BEAN_SAUSAGE, I.FANCY_APPLE, I.SOFT_POTATO),
        5200, 20.3, 2.4, ((1,), (2, 3), (4, 4, 3)), 11, 0, 1,
    ),
    Species(
        "Tyrantrum", 697, Specialty.BERRIES, Berry.SITRUS, SleepType.SLUMBERING,
        "Cooking Power-Up S",
        (I.BEAN_SAUSAGE, I.FANCY_APPLE, I.SOFT_POTATO),
        2800, 17.8, 2.9, ((1,), (2, 3), (4, 4, 3)), 23, 1, 1,
    ),
    Species(
        "Sylveon", 700, Specialty.SKILLS, Berry.PECHA, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE),
        2600, 17.8, 4, ((1,), (2, 1), (4, 2, 3)), 15, 1, 1,
    ),
    Species(
        "Dedenne", 702, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Tasty Chance S",
        (I.FANCY_APPLE, I.SOOTHING_CACAO, I.GREENGRASS_CORN),
        2500, 17.7, 4.5, ((1,), (2, 1), (4, 2, 2)), 19,
    ),
    Species(
        "Pumpkaboo (Small)", 710, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        5300, 12, 4.9, ((2,), (5, 11), (7, 18, 15)), 7, 0, 1,
    ),
    Species(
        "Pumpkaboo (Medium)", 710, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        5400, 12, 4.9, ((2,), (5, 11), (7, 18, 15)), 11, 0, 1,
    ),
    Species(
        "Pumpkaboo (Large)", 710, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        5500, 12, 4.9, ((2,), (5, 11), (7, 18, 15)), 15, 0, 1,
    ),
    Species(
        "Pumpkaboo (Jumbo)", 710, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        5600, 12, 4.9, ((2,), (5, 11), (7, 18, 15)), 21, 0, 1,
    ),
    Species(
        "Gourgeist (Small)", 711, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        3100, 13, 4.9, ((2,), (5, 11), (7, 18, 15)), 10, 1, 1,
    ),
    Species(
        "Gourgeist (Medium)", 711, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        3200, 13, 4.9, ((2,), (5, 11), (7, 18, 15)), 14, 1, 1,
    ),
    Species(
        "Gourgeist (Large)", 711, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        3300, 13, 4.9, ((2,), (5, 11), (7, 18, 15)), 19, 1, 1,
    ),
    Species(
        "Gourgeist (Jumbo)", 711, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Strength S",
        (I.PLUMP_PUMPKIN, I.GREENGRASS_SOYBEANS, I.SOFT_POTATO),
        3400, 13, 4.9, ((2,), (5, 11), (7, 18, 15)), 25, 1, 1,
    ),
    Species(
        "Noibat", 714, Specialty.SKILLS, Berry.YACHE, SleepType.DOZING,
        "Charge Strength M",
        (I.FANCY_APPLE, I.LARGE_LEEK, I.BEAN_SAUSAGE),
        5100, 19.8, 4.8, ((1,), (2, 1), (4, 2, 3)), 7, 0, 1,
    ),
    Species(
        "Noivern", 715, Specialty.SKILLS, Berry.YACHE, SleepType.DOZING,
        "Charge Strength M",
        (I.FANCY_APPLE, I.LARGE_LEEK, I.BEAN_SAUSAGE),
        2700, 19.5, 4.8, ((1,), (2, 1), (4, 2, 3)), 18, 1, 1,
    ),
    Species(
        "Grubbin", 736, Specialty.INGREDIENTS, Berry.LUM, SleepType.DOZING,
        "Charge Strength S",
        (I.ROUSING_COFFEE, I.TASTY_MUSHROOM, I.HONEY),
        4600, 15.5, 2.9, ((2,), (5, 4), (7, 7, 11)), 11, 0, 2,
    ),
    Species(
        "Charjabug", 737, Specialty.INGREDIENTS, Berry.LUM, SleepType.DOZING,
        "Charge Strength S",
        (I.ROUSING_COFFEE, I.TASTY_MUSHROOM, I.HONEY),
        3300, 15.4, 2.8, ((2,), (5, 4), (7, 7, 11)), 15, 1, 2,
    ),
    Species(
        "Vikavolt", 738, Specialty.INGREDIENTS, Berry.LUM, SleepType.DOZING,
        "Charge Strength S",
        (I.ROUSING_COFFEE, I.TASTY_MUSHROOM, I.HONEY),
        2800, 19.4, 5.1, ((2,), (5, 4), (7, 7, 11)), 19, 2, 2,
    ),
    Species(
        "Cutiefly", 742, Specialty.INGREDIENTS, Berry.PECHA, SleepType.SNOOZING,
        "Ingredient Draw S",
        (I.HONEY, I.PURE_OIL, I.GREENGRASS_CORN),
        4500, 19.9, 1.9, ((2,), (5, 4), (7, 6, 5)), 9, 0, 1,
    ),
    Species(
        "Ribombee", 743, Specialty.INGREDIENTS, Berry.PECHA, SleepType.SNOOZING,
        "Ingredient Draw S",
        (I.HONEY, I.PURE_OIL, I.GREENGRASS_CORN),
        2300, 19.4, 2.5, ((2,), (5, 4), (7, 6, 5)), 19, 1, 1,
    ),
    Species(
        "Stufful", 759, Specialty.INGREDIENTS, Berry.CHERI, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.GREENGRASS_CORN, I.BEAN_SAUSAGE, I.FANCY_EGG),
        4100, 22.5, 1.1, ((2,), (5, 6), (7, 10, 9)), 13, 0, 1,
    ),
    Species(
        "Bewear", 760, Specialty.INGREDIENTS, Berry.CHERI, SleepType.SLUMBERING,
        "Charge Strength S (Random)",
        (I.GREENGRASS_CORN, I.BEAN_SAUSAGE, I.FANCY_EGG),
        2800, 22.9, 1.3, ((2,), (5, 6), (7, 10, 9)), 20, 1, 1,
    ),
    Species(
        "Comfey", 764, Specialty.INGREDIENTS, Berry.PECHA, SleepType.SNOOZING,
        "Energizing Cheer S",
        (I.GREENGRASS_CORN, I.WARMING_GINGER, I.SOOTHING_CACAO),
        2500, 16.7, 3.5, ((2,), (5, 6), (7, 9, 7)), 20,
    ),
    Species(
        "Togedemaru", 777, Specialty.SKILLS, Berry.BELUE, SleepType.SLUMBERING,
        "Energizing Cheer S (Nuzzle)",
        (I.MOOMOO_MILK, I.GLOSSY_AVOCADO, I.SOOTHING_CACAO),
        2700, 16.9, 5.5, ((1,), (2, 1), (4, 2, 2)), 18,
    ),
    Species(
        "Mimikyu", 778, Specialty.SKILLS, Berry.BLUK, SleepType.DOZING,
        "Berry Burst (Disguise)",
        (I.FANCY_APPLE, I.ROUSING_COFFEE, I.TASTY_MUSHROOM),
        2500, 15.3, 3.5, ((1,), (2, 1), (4, 2, 2)), 19,
    ),
    Species(
        "Drampa", 780, Specialty.INGREDIENTS, Berry.YACHE, SleepType.DOZING,
        "Tasty Chance S",
        (I.GREENGRASS_SOYBEANS, I.GLOSSY_AVOCADO, I.BEAN_SAUSAGE),
        3500, 29.4, 4.6, ((2,), (5, 3), (7, 4, 7)), 25,
    ),
    Species(
        "Cramorant", 845, Specialty.INGREDIENTS, Berry.PAMTRE, SleepType.SLUMBERING,
        "Tasty Chance S",
        (I.PURE_OIL, I.SOFT_POTATO, I.FANCY_EGG),
        2700, 16.5, 3.9, ((2,), (5, 4), (7, 7, 8)), 19,
    ),
    Species(
        "Toxel", 848, Specialty.SKILLS, Berry.CHESTO, SleepType.SLUMBERING,
        "Ingredient Magnet S",
        (I.MOOMOO_MILK, I.FANCY_APPLE, I.LARGE_LEEK),
        5600, 20.9, 4.8, ((1,), (2, 2), (4, 4, 2)), 6, 0, 1,
    ),
    Species(
        "Toxtricity (Amped)", 849, Specialty.SKILLS, Berry.CHESTO, SleepType.DOZING,
        "Ingredient Magnet S (Plus)",
        (I.MOOMOO_MILK, I.FANCY_APPLE, I.LARGE_LEEK),
        3100, 23.9, 6.4, ((1,), (2, 2), (4, 4, 2)), 18, 1, 1,
    ),
    Species(
        "Toxtricity (Low Key)", 849, Specialty.SKILLS, Berry.CHESTO, SleepType.DOZING,
        "Cooking Power-Up S (Minus)",
        (I.MOOMOO_MILK, I.FANCY_APPLE, I.LARGE_LEEK),
        3100, 23.9, 6.4, ((1,), (2, 2), (4, 4, 2)), 18, 1, 1,
    ),
    Species(
        "Sprigatito", 906, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Cooking Power-Up S",
        (I.SOFT_POTATO, I.MOOMOO_MILK, I.WARMING_GINGER),
        4600, 20.8, 2.3, ((2,), (5, 6), (7, 9, 8)), 10, 0, 2,
    ),
    Species(
        "Floragato", 907, Specialty.INGREDIENTS, Berry.DURIN, SleepType.DOZING,
        "Cooking Power-Up S",
        (I.SOFT_POTATO, I.MOOMOO_MILK, I.WARMING_GINGER),
        3500, 20.9, 2.3, ((2,), (5, 6), (7, 9, 8)), 14, 1, 2,
    ),
    Species(
        "Meowscarada", 908, Specialty.INGREDIENTS, Berry.WIKI, SleepType.DOZING,
        "Cooking Power-Up S",
        (I.SOFT_POTATO, I.MOOMOO_MILK, I.WARMING_GINGER),
        2600, 19, 2.2, ((2,), (5, 6), (7, 9, 8)), 18, 2, 2,
    ),
    Species(
        "Fuecoco", 909, Specialty.INGREDIENTS, Berry.LEPPA, SleepType.SNOOZING,
        "Charge Energy S",
        (I.FANCY_APPLE, I.BEAN_SAUSAGE, I.FIERY_HERB),
        4200, 25.4, 5.3, ((2,), (5, 4), (7, 6, 5)), 11, 0, 2,
    ),
    Species(
        "Crocalor", 910, Specialty.INGREDIENTS, Berry.LEPPA, SleepType.SNOOZING,
        "Charge Energy S",
        (I.FANCY_APPLE, I.BEAN_SAUSAGE, I.FIERY_HERB),
        3100, 24.7, 5, ((2,), (5, 4), (7, 6, 5)), 16, 1, 2,
    ),
    Species(
        "Skeledirge", 911, Specialty.INGREDIENTS, Berry.BLUK, SleepType.DOZING,
        "Charge Energy S",
        (I.FANCY_APPLE, I.BEAN_SAUSAGE, I.FIERY_HERB),
        2700, 26.8, 6.2, ((2,), (5, 4), (7, 6, 5)), 19, 2, 2,
    ),
    Species(
        "Quaxly", 912, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Strength M",
        (I.GREENGRASS_SOYBEANS, I.LARGE_LEEK, I.PURE_OIL),
        4800, 26.1, 2.8, ((2,), (5, 2), (7, 4, 6)), 10, 0, 2,
    ),
    Species(
        "Quaxwell", 913, Specialty.INGREDIENTS, Berry.ORAN, SleepType.SLUMBERING,
        "Charge Strength M",
        (I.GREENGRASS_SOYBEANS, I.LARGE_LEEK, I.PURE_OIL),
        3600, 25.9, 2.7, ((2,), (5, 2), (7, 4, 6)), 14, 1, 2,
    ),
    Species(
        "Quaquaval", 914, Specialty.INGREDIENTS, Berry.CHERI, SleepType.SLUMBERING,
        "Charge Strength M",
        (I.GREENGRASS_SOYBEANS, I.LARGE_LEEK, I.PURE_OIL),
        2600, 23.2, 2.4, ((2,), (5, 2), (7, 4, 6)), 19, 2, 2,
    ),
    Species(
        "Pawmi", 921, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.SOOTHING_CACAO, I.MOOMOO_MILK, I.FANCY_EGG),
        4600, 11.1, 3.6, ((1,), (2, 3), (4, 6, 5)), 9, 0, 2,
    ),
    Species(
        "Pawmo", 922, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.SOOTHING_CACAO, I.MOOMOO_MILK, I.FANCY_EGG),
        3300, 10.9, 3.6, ((1,), (2, 3), (4, 6, 5)), 12, 1, 2,
    ),
    Species(
        "Pawmot", 923, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Energy for Everyone S",
        (I.SOOTHING_CACAO, I.MOOMOO_MILK, I.FANCY_EGG),
        2400, 14.1, 3.9, ((1,), (2, 3), (4, 6, 5)), 18, 2, 2,
    ),
    Species(
        "Cetoddle", 974, Specialty.INGREDIENTS, Berry.RAWST, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.SOFT_POTATO, I.BEAN_SAUSAGE, I.PLUMP_PUMPKIN),
        5100, 22.3, 4.2, ((2,), (5, 5), (7, 9, 4)), 12, 0, 1,
    ),
    Species(
        "Cetitan", 975, Specialty.INGREDIENTS, Berry.RAWST, SleepType.SLUMBERING,
        "Charge Energy S",
        (I.SOFT_POTATO, I.BEAN_SAUSAGE, I.PLUMP_PUMPKIN),
        2800, 20.9, 4.2, ((2,), (5, 5), (7, 9, 4)), 25, 1, 1,
    ),
    Species(
        "Clodsire", 980, Specialty.INGREDIENTS, Berry.CHESTO, SleepType.DOZING,
        "Charge Energy S",
        (I.SOOTHING_CACAO, I.ROUSING_COFFEE, I.SOFT_POTATO),
        3500, 20.8, 5.5, ((2,), (5, 4), (7, 7, 9)), 20, 1, 1,
    ),
)
