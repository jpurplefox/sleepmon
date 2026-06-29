"""Objetos de transferencia entre el borde (HTTP) y los casos de uso.

Las entradas llegan como strings (lo que manda el cliente); el service las parsea a
los enums del dominio y valida. Las salidas de distribución usan strings como claves
para serializar derecho.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class IngredientCountDTO:
    """Un ingrediente requerido por una receta, con su cantidad."""

    ingredient: str
    count: int


@dataclass(frozen=True, slots=True)
class RecipeDTO:
    """Una receta del catálogo, lista para serializar."""

    name: str
    type: str
    ingredients: list[IngredientCountDTO]
    base_strength: int


@dataclass(frozen=True, slots=True)
class TeamMemberInput:
    """Datos crudos para crear o actualizar un miembro del equipo."""

    species: str
    level: int
    nature: str
    ingredients: list[str]
    sub_skills: list[str] = field(default_factory=list)
    ribbon: str = ""  # vacío = sin listón
    skill_level: int = 1  # nivel de la main skill (1..MAX_SKILL_LEVEL)


@dataclass(frozen=True, slots=True)
class Distributions:
    """Distribuciones agregadas del equipo, listas para serializar."""

    natures: dict[str, int]
    ingredients: dict[str, int]
    sub_skills: dict[str, int]
    nature_stats: dict[str, int]


@dataclass(frozen=True, slots=True)
class ProductionInput:
    """Datos crudos para estimar la producción de un Pokémon (no se persiste)."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza (sin efecto)
    sub_skills: list[str] = field(default_factory=list)
    ribbon: str = ""  # vacío = sin listón
    skill_level: int = 1  # nivel de la main skill (1..MAX_SKILL_LEVEL)


@dataclass(frozen=True, slots=True)
class SlotAmount:
    """Producción diaria de un slot de ingrediente, lista para serializar."""

    ingredient: str
    amount: float


@dataclass(frozen=True, slots=True)
class MemberProduction:
    """Producción diaria resumida de un miembro de la caja, para el overview.

    Un subconjunto de ``ProductionResult``: lo que el overview necesita leer de un
    vistazo (bayas, ingredientes —total y por ingrediente—, disparos de skill). El
    cálculo es el mismo del dominio que alimenta ``/production``; acá solo se resume.
    """

    berries: float  # bayas/día
    berry_strength: float  # fuerza/día DIRECTA de las bayas (bayas × fuerza por baya del nivel)
    ingredients: list[SlotAmount]  # ingredientes/día por ayuda normal, por ingrediente
    ingredients_total: float  # suma de los ingredientes/día por ayuda normal
    skill_triggers: float  # disparos de la main skill/día
    # Ingredientes/día que aporta la main skill por ingrediente (Ingredient Draw S,
    # p. ej. Crustle). Vacío si la skill de la especie no da ingredientes específicos.
    skill_ingredients: list[SlotAmount]
    # Ingredientes/día al azar que consigue la main skill (Ingredient Magnet S, p. ej.
    # Plusle), como total sin desglosar. None si no aplica.
    skill_ingredient_total: float | None
    # Otras salidas de la main skill (una por especie según su tipo de skill; el resto
    # None). Mismas magnitudes que ProductionResult, para mostrar el aporte de la skill
    # junto a sus disparos en el overview.
    skill_energy: float | None  # Energy for Everyone S (energía a cada compañero)
    skill_cooking_ingredients: float | None  # Cooking Power-Up S (ingredientes de pote)
    skill_strength: float | None  # Charge Strength S/M (Vigor a Snorlax)
    skill_self_energy: float | None  # Charge Energy S (energía al propio)
    skill_dream_shards: float | None  # Dream Shard Magnet S (fragmentos de sueño)
    skill_tasty_chance: float | None  # Tasty Chance S (+% de plato riquísimo)
    skill_extra_helpful: float | None  # Extra Helpful S (×multiplicador de ayuda)
    skill_random_energy: float | None  # Energizing Cheer S (energía a un compañero al azar)


@dataclass(frozen=True, slots=True)
class ProductionResult:
    """Producción estimada de un Pokémon en un día."""

    helps_per_day: float
    seconds_per_help: int
    berry: str
    berry_amount: float
    berry_strength: float  # fuerza/día DIRECTA de las bayas
    berry_percentage: float
    ingredient_percentage: float
    skill_percentage: float
    effective_skill_percentage: float
    ingredients: list[SlotAmount]
    skill_triggers: float
    skill_ingredients: list[SlotAmount]
    skill_energy: float | None
    skill_ingredient_total: float | None
    skill_cooking_ingredients: float | None
    skill_strength: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None
    night_skill_chances: list[float]
    inventory: int
    inventory_fill_hours: float
