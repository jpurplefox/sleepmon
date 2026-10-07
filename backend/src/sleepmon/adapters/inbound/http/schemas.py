"""Schemas de entrada/salida HTTP (msgspec). Desacoplan el JSON del dominio."""

from __future__ import annotations

import msgspec

from sleepmon.domain.catalog_data import DEFAULT_POT_SIZE


class MemberIn(msgspec.Struct, forbid_unknown_fields=True):
    """Payload para crear o actualizar un miembro."""

    species: str
    level: int
    ingredients: list[str]
    nature: str = ""  # vacío = sin naturaleza
    sub_skills: list[str] = []
    ribbon: str = ""  # vacío = sin listón
    skill_level: int = 1  # nivel de la main skill


class BerryYieldOut(msgspec.Struct):
    berry: str
    amount: float
    strength: float


class BerrySourceOut(msgspec.Struct):
    kind: str
    member_id: str | None
    species: str | None
    amount: float
    strength_base: float


class TeamBerryRowOut(msgspec.Struct):
    berry: str
    amount: float
    strength: float
    strength_base: float
    sources: list[BerrySourceOut]


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
    skill_berry_amount: float | None = None
    skill_berries_per_teammate: float | None = None
    skill_help_targets: int | None = None


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


class RatingOut(msgspec.Struct):
    tier: str
    level: int
    required_strength: int


class ExpertSpeedOut(msgspec.Struct):
    """An expert map's help-interval factors: main berry, and no favorite berry."""

    main: float
    penalty: float


class IslandOut(msgspec.Struct):
    name: str
    favorite_berries: list[str]
    user_picks: bool
    expert: bool
    ratings: list[RatingOut]
    expert_speed: ExpertSpeedOut | None


class CatalogOut(msgspec.Struct):
    natures: list[NatureOut]
    sub_skills: list[SubSkillOut]
    ingredients: list[str]
    species: list[SpeciesOut]
    recipe_level_bonus: list[float]
    pot_ladder: list[int]
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
    scenario: str = "none"  # ComparisonScenario: "none" = no berry bonus


class SlotProductionOut(msgspec.Struct):
    ingredient: str
    amount: float


class SleepSessionOut(msgspec.Struct):
    kind: str  # "night" | "nap"
    hours: float
    overflow_hours: float
    skill_chances: list[float]


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
    effective_skill_level: int
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
    sleep_sessions: list[SleepSessionOut]
    inventory: int
    inventory_fill_hours: float
    skill_berry_amount: float | None = None
    skill_berry_strength: float | None = None
    skill_berries_per_teammate: float | None = None
    skill_help_targets: int | None = None
    skill_candy: float | None = None
    skill_berry_juice: float | None = None
    teammate_berries: list[BerryYieldOut] | None = None
    teammate_ingredients: list[SlotProductionOut] | None = None


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


class ProgressOut(msgspec.Struct):
    """The user's full progress. GET and PATCH both return this."""

    pot_size: int
    recipe_levels: dict[str, int]
    favorite_recipes: dict[str, str]
    area_bonuses: dict[str, int]


class ProgressPatchIn(msgspec.Struct, forbid_unknown_fields=True):
    """A partial change: an absent (``None``) field is left untouched.

    Inside a mapping, the default value clears the key: level 1, bonus 0,
    favorite ``null``.
    """

    pot_size: int | None = None
    recipe_levels: dict[str, int] | None = None
    favorite_recipes: dict[str, str | None] | None = None
    area_bonuses: dict[str, int] | None = None


class GoogleLoginIn(msgspec.Struct, forbid_unknown_fields=True):
    credential: str


class UserOut(msgspec.Struct):
    id: str
    email: str
    display_name: str
    avatar_url: str | None


class AuthOut(msgspec.Struct):
    access_token: str
    user: UserOut


class MealIn(msgspec.Struct, forbid_unknown_fields=True):
    recipe: str
    level: int = 1


class SlotEntryIn(msgspec.Struct, forbid_unknown_fields=True):
    id: str
    pokemon: ProductionIn
    weight: float = 1.0


class SlotIn(msgspec.Struct, forbid_unknown_fields=True):
    entries: list[SlotEntryIn]


class EventEffectIn(msgspec.Struct, forbid_unknown_fields=True):
    kind: str
    value: float
    scope: str = "team"
    target: str | None = None


class TeamProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    slots: list[SlotIn]
    meals: list[MealIn | None] = msgspec.field(default_factory=list)
    favorite_berries: list[str] = msgspec.field(default_factory=list)
    island: str | None = None
    main_favorite: str | None = None
    weekly_bonus: str | None = None
    island_bonus: float = 0.0
    good_camp_ticket: bool = False
    pot_size: int = DEFAULT_POT_SIZE
    event_effects: list[EventEffectIn] = msgspec.field(default_factory=list)


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
    strength: float
    strength_base: float
    fits_pot: bool
    ingredients: list[SlotIngredientStatusOut]


class PotOut(msgspec.Struct):
    per_meal: int
    skill_per_meal: int
    daily: float
    base_daily: int
    skill_daily: float
    bonus_daily: float
    used_by_recipes: int
    filler_room: float


class FillerOut(msgspec.Struct):
    ingredient: str | None
    strength: float
    available: float
    used: float
    contributed: float


class KitchenOut(msgspec.Struct):
    pot: PotOut
    fillers: list[FillerOut]
    recipe_strength: float
    recipe_strength_base: float
    filler_strength: float
    filler_strength_base: float
    extra_tasty_bonus: float
    total: float
    total_base: float


class SkillEffectAggOut(msgspec.Struct):
    kind: str
    total: float
    triggers: float


class MemberContributionOut(msgspec.Struct):
    id: str
    species: str
    strength: float
    strength_base: float
    berry_amount: float
    ingredients_total: float
    skill_triggers: float
    production: ProductionOut


class TeamProductionOut(msgspec.Struct):
    member_count: int
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
    skill_random_energy: float | None
    skill_cooking_ingredients: float | None
    skill_ingredient_total: float | None
    extra_tasty_rate: float
    extra_tasty_multiplier: float
    skill_effects: list[SkillEffectAggOut]
    members: list[MemberContributionOut]
    kitchen: KitchenOut
    cooking_ingredients: list[IngredientBalanceOut]
    cooking_surplus: list[IngredientBalanceOut]
    cooking_meals: list[MealFeasibilityOut]
    grand_total_strength: float
    grand_total_strength_base: float
    berries: list[TeamBerryRowOut] = []
