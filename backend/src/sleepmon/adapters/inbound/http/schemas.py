"""Schemas de entrada/salida HTTP (msgspec). Desacoplan el JSON del dominio."""

from __future__ import annotations

import msgspec


class MemberIn(msgspec.Struct, forbid_unknown_fields=True):
    """Payload para crear o actualizar un miembro."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza
    sub_skills: list[str] = []
    ribbon: str = ""  # vacío = sin listón
    skill_level: int = 1  # nivel de la main skill


class MemberProductionOut(msgspec.Struct):
    """Producción diaria resumida de un miembro (overview de la Caja)."""

    berries: float
    berry_strength: float  # fuerza/día DIRECTA de las bayas
    ingredients: list[SlotProductionOut]
    ingredients_total: float
    skill_triggers: float
    # Ingredientes por la main skill: específicos (Ingredient Draw) y/o total al
    # azar (Ingredient Magnet). Vacío/None si la skill no produce ingredientes.
    skill_ingredients: list[SlotProductionOut]
    skill_ingredient_total: float | None
    # Otras salidas de la main skill (una por especie; el resto None).
    skill_energy: float | None
    skill_cooking_ingredients: float | None
    skill_strength: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None


class MemberOut(msgspec.Struct):
    id: str
    species: str
    level: int
    nature: str
    ingredients: list[str]
    sub_skills: list[str]
    ribbon: str
    skill_level: int
    # Producción del overview. Presente en el listado (/team); None en respuestas
    # de un solo miembro (alta/edición/detalle), donde no hace falta.
    production: MemberProductionOut | None = None


class NatureOut(msgspec.Struct):
    name: str
    neutral: bool
    increased: str | None = None
    decreased: str | None = None


class SubSkillOut(msgspec.Struct):
    name: str
    tier: str


class SpeciesOut(msgspec.Struct):
    name: str
    dex: int
    specialty: str
    berry: str
    type: str
    sleep_type: str
    main_skill: str
    ingredient_slots: list[list[str]]
    ingredient_amounts: list[list[int]]
    base_inventory: int


class IslandOut(msgspec.Struct):
    name: str
    favorite_berries: list[str]
    user_picks: bool


class CatalogOut(msgspec.Struct):
    natures: list[NatureOut]
    sub_skills: list[SubSkillOut]
    ingredients: list[str]
    species: list[SpeciesOut]
    recipe_level_bonus: list[float]
    ingredient_strengths: dict[str, int]
    islands: list[IslandOut]


class DistributionsOut(msgspec.Struct):
    natures: dict[str, int]
    ingredients: dict[str, int]
    sub_skills: dict[str, int]
    nature_stats: dict[str, int]


class ProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    """Payload para estimar producción: especie, nivel, ingredientes, naturaleza y sub skills."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza
    sub_skills: list[str] = msgspec.field(default_factory=list)
    ribbon: str = ""  # vacío = sin listón
    skill_level: int = 1  # nivel de la main skill


class SlotProductionOut(msgspec.Struct):
    ingredient: str
    amount: float


class ProductionOut(msgspec.Struct):
    helps_per_day: float
    seconds_per_help: int
    berry: str
    berry_amount: float
    berry_strength: float  # fuerza/día DIRECTA de las bayas
    berry_percentage: float
    ingredient_percentage: float
    skill_percentage: float
    effective_skill_percentage: float
    ingredients: list[SlotProductionOut]
    skill_triggers: float
    skill_ingredients: list[SlotProductionOut]
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


class IngredientCountOut(msgspec.Struct):
    ingredient: str
    count: int


class RecipeOut(msgspec.Struct):
    name: str
    type: str
    ingredients: list[IngredientCountOut]
    base_strength: int


class ErrorOut(msgspec.Struct):
    detail: str


class MealIn(msgspec.Struct, forbid_unknown_fields=True):
    recipe: str
    level: int = 1


class TeamProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    member_ids: list[str]
    meals: list[MealIn | None] = msgspec.field(default_factory=list)
    favorite_berries: list[str] = msgspec.field(default_factory=list)
    island_bonus: float = 0.0
    good_camp_ticket: bool = False


class IngredientBalanceOut(msgspec.Struct):
    ingredient: str
    required: float
    produced: float
    balance: float


class SlotIngredientStatusOut(msgspec.Struct, frozen=True):
    ingredient: str
    required: int
    available: float


class MealFeasibilityOut(msgspec.Struct):
    recipe_name: str
    met: bool
    level: int
    strength: int
    ingredients: list[SlotIngredientStatusOut]


class SkillEffectAggOut(msgspec.Struct):
    kind: str
    total: float
    triggers: float


class MemberContributionOut(msgspec.Struct):
    member_id: str
    species: str
    strength: float
    strength_base: float
    berry_amount: float
    ingredients_total: float
    skill_triggers: float
    production: ProductionOut


class TeamProductionOut(msgspec.Struct):
    member_count: int
    excluded_count: int
    total_strength: float
    total_berry_amount: float
    total_berry_strength: float
    total_skill_strength: float
    total_strength_base: float
    total_berry_strength_base: float
    total_skill_strength_base: float
    island_bonus: float
    ingredients: list[SlotProductionOut]
    total_ingredients: float
    skill_triggers: float
    skill_energy: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None
    skill_cooking_ingredients: float | None
    skill_ingredient_total: float | None
    extra_tasty_rate: float
    extra_tasty_multiplier: float
    skill_effects: list[SkillEffectAggOut]
    members: list[MemberContributionOut]
    cooking_strength: float
    cooking_strength_base: float
    cooking_ingredients: list[IngredientBalanceOut]
    cooking_surplus: list[IngredientBalanceOut]
    cooking_meals: list[MealFeasibilityOut]
    grand_total_strength: float
    grand_total_strength_base: float
