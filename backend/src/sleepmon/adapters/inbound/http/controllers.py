"""Controllers Litestar: traducen HTTP ↔ DTO y delegan en la aplicación."""

from __future__ import annotations

from uuid import UUID

from litestar import Controller, delete, get, post, put
from litestar.di import NamedDependency
from litestar.params import FromPath
from litestar.status_codes import HTTP_200_OK, HTTP_201_CREATED

from sleepmon.adapters.inbound.http.schemas import (
    CatalogOut,
    DistributionsOut,
    IngredientBalanceOut,
    IngredientCountOut,
    IslandOut,
    MealFeasibilityOut,
    MemberContributionOut,
    MemberIn,
    MemberOut,
    MemberProductionOut,
    NatureOut,
    ProductionIn,
    ProductionOut,
    RecipeOut,
    SkillEffectAggOut,
    SlotIngredientStatusOut,
    SlotProductionOut,
    SpeciesOut,
    SubSkillOut,
    TeamProductionIn,
    TeamProductionOut,
)
from sleepmon.application.dto import (
    MealSelectionInput,
    MemberProduction,
    ProductionInput,
    ProductionResult,
    TeamMemberInput,
    TeamProductionInput,
)
from sleepmon.application.services import TeamService
from sleepmon.domain.catalog_data import (
    INGREDIENT_STRENGTH,
    ISLAND_FAVORITE_BERRIES,
    ISLAND_USER_PICKS,
    NATURE_EFFECTS,
    RECIPE_LEVEL_BONUS,
    SUB_SKILL_TIERS,
)
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.ports import SpeciesCatalog
from sleepmon.domain.value_objects import Ingredient, Island, Nature, SubSkill


def _full_production_out(result: ProductionResult) -> ProductionOut:
    """Convierte un ``ProductionResult`` DTO a su schema de respuesta HTTP."""
    return ProductionOut(
        helps_per_day=result.helps_per_day,
        seconds_per_help=result.seconds_per_help,
        berry=result.berry,
        berry_amount=result.berry_amount,
        berry_strength=result.berry_strength,
        berry_percentage=result.berry_percentage,
        ingredient_percentage=result.ingredient_percentage,
        skill_percentage=result.skill_percentage,
        effective_skill_percentage=result.effective_skill_percentage,
        ingredients=[
            SlotProductionOut(ingredient=slot.ingredient, amount=slot.amount)
            for slot in result.ingredients
        ],
        skill_triggers=result.skill_triggers,
        skill_ingredients=[
            SlotProductionOut(ingredient=slot.ingredient, amount=slot.amount)
            for slot in result.skill_ingredients
        ],
        skill_energy=result.skill_energy,
        skill_ingredient_total=result.skill_ingredient_total,
        skill_cooking_ingredients=result.skill_cooking_ingredients,
        skill_strength=result.skill_strength,
        skill_self_energy=result.skill_self_energy,
        skill_dream_shards=result.skill_dream_shards,
        skill_tasty_chance=result.skill_tasty_chance,
        skill_extra_helpful=result.skill_extra_helpful,
        skill_random_energy=result.skill_random_energy,
        night_skill_chances=result.night_skill_chances,
        inventory=result.inventory,
        inventory_fill_hours=result.inventory_fill_hours,
    )


def _production_out(production: MemberProduction | None) -> MemberProductionOut | None:
    if production is None:
        return None
    return MemberProductionOut(
        berries=production.berries,
        berry_strength=production.berry_strength,
        ingredients=[
            SlotProductionOut(ingredient=s.ingredient, amount=s.amount)
            for s in production.ingredients
        ],
        ingredients_total=production.ingredients_total,
        skill_triggers=production.skill_triggers,
        skill_ingredients=[
            SlotProductionOut(ingredient=s.ingredient, amount=s.amount)
            for s in production.skill_ingredients
        ],
        skill_ingredient_total=production.skill_ingredient_total,
        skill_energy=production.skill_energy,
        skill_cooking_ingredients=production.skill_cooking_ingredients,
        skill_strength=production.skill_strength,
        skill_self_energy=production.skill_self_energy,
        skill_dream_shards=production.skill_dream_shards,
        skill_tasty_chance=production.skill_tasty_chance,
        skill_extra_helpful=production.skill_extra_helpful,
        skill_random_energy=production.skill_random_energy,
    )


def _to_out(member: TeamMember, production: MemberProduction | None = None) -> MemberOut:
    return MemberOut(
        id=str(member.id),
        species=member.species,
        level=member.level,
        nature=member.nature.value if member.nature else "",
        ingredients=[i.value for i in member.ingredients],
        sub_skills=[s.value for s in member.sub_skills],
        ribbon=member.ribbon.value,
        skill_level=member.skill_level,
        production=_production_out(production),
    )


def _nature_out(nature: Nature) -> NatureOut:
    effect = NATURE_EFFECTS[nature]
    return NatureOut(
        name=nature.value,
        neutral=effect.is_neutral,
        increased=effect.increased.value if effect.increased is not None else None,
        decreased=effect.decreased.value if effect.decreased is not None else None,
    )


def _to_input(payload: MemberIn) -> TeamMemberInput:
    return TeamMemberInput(
        species=payload.species,
        level=payload.level,
        nature=payload.nature,
        ingredients=payload.ingredients,
        sub_skills=payload.sub_skills,
        ribbon=payload.ribbon,
        skill_level=payload.skill_level,
    )


class TeamController(Controller):
    path = "/team"

    @get("/", sync_to_thread=True)
    def list_members(self, service: NamedDependency[TeamService]) -> list[MemberOut]:
        return [_to_out(m, p) for m, p in service.list_members_with_production()]

    @post("/", status_code=HTTP_201_CREATED, sync_to_thread=True)
    def add_member(self, service: NamedDependency[TeamService], data: MemberIn) -> MemberOut:
        return _to_out(service.add_member(_to_input(data)))

    @get("/distributions", sync_to_thread=True)
    def distributions(self, service: NamedDependency[TeamService]) -> DistributionsOut:
        dist = service.distributions()
        return DistributionsOut(
            natures=dist.natures,
            ingredients=dist.ingredients,
            sub_skills=dist.sub_skills,
            nature_stats=dist.nature_stats,
        )

    @get("/{member_id:uuid}", sync_to_thread=True)
    def get_member(
        self, service: NamedDependency[TeamService], member_id: FromPath[UUID]
    ) -> MemberOut:
        return _to_out(service.get_member(member_id))

    @put("/{member_id:uuid}", sync_to_thread=True)
    def update_member(
        self, service: NamedDependency[TeamService], member_id: FromPath[UUID], data: MemberIn
    ) -> MemberOut:
        return _to_out(service.update_member(member_id, _to_input(data)))

    @delete("/{member_id:uuid}", sync_to_thread=True)
    def delete_member(
        self, service: NamedDependency[TeamService], member_id: FromPath[UUID]
    ) -> None:
        service.delete_member(member_id)


class ProductionController(Controller):
    path = "/production"

    @post("/", status_code=HTTP_200_OK, sync_to_thread=True)
    def compute(self, service: NamedDependency[TeamService], data: ProductionIn) -> ProductionOut:
        result = service.compute_production(
            ProductionInput(
                species=data.species,
                level=data.level,
                ingredients=data.ingredients,
                nature=data.nature,
                sub_skills=data.sub_skills,
                ribbon=data.ribbon,
                skill_level=data.skill_level,
            )
        )
        return _full_production_out(result)


class CatalogController(Controller):
    path = "/catalog"

    @get("/", sync_to_thread=False)
    def get_catalog(self, catalog: NamedDependency[SpeciesCatalog]) -> CatalogOut:
        return CatalogOut(
            natures=[_nature_out(n) for n in Nature],
            sub_skills=[SubSkillOut(name=s.value, tier=SUB_SKILL_TIERS[s].value) for s in SubSkill],
            ingredients=[i.value for i in Ingredient],
            recipe_level_bonus=list(RECIPE_LEVEL_BONUS),
            ingredient_strengths={ing.value: INGREDIENT_STRENGTH[ing] for ing in Ingredient},
            species=[
                SpeciesOut(
                    name=sp.name,
                    dex=sp.dex,
                    specialty=sp.specialty.value,
                    berry=sp.berry.value,
                    type=sp.type.value,
                    sleep_type=sp.sleep_type.value,
                    main_skill=sp.main_skill,
                    ingredient_slots=[
                        [ing.value for ing in slot] for slot in sp.ingredient_slots
                    ],
                    ingredient_amounts=[list(slot) for slot in sp.ingredient_amounts],
                    base_inventory=sp.base_inventory,
                )
                for sp in catalog.all()
            ],
            islands=[
                IslandOut(
                    name=island.value,
                    favorite_berries=[b.value for b in ISLAND_FAVORITE_BERRIES[island]],
                    user_picks=island in ISLAND_USER_PICKS,
                )
                for island in Island
            ],
        )


class RecipeController(Controller):
    path = "/recipes"

    @get("/", sync_to_thread=False)
    def list_recipes(self, service: NamedDependency[TeamService]) -> list[RecipeOut]:
        return [
            RecipeOut(
                name=r.name,
                type=r.type,
                ingredients=[
                    IngredientCountOut(ingredient=i.ingredient, count=i.count)
                    for i in r.ingredients
                ],
                base_strength=r.base_strength,
            )
            for r in service.list_recipes()
        ]


class TeamProductionController(Controller):
    path = "/teams/production"

    @post("/", status_code=HTTP_200_OK, sync_to_thread=True)
    def compute(
        self, service: NamedDependency[TeamService], data: TeamProductionIn
    ) -> TeamProductionOut:
        result = service.compute_team_production(
            TeamProductionInput(
                member_ids=data.member_ids,
                meals=[
                    None if m is None else MealSelectionInput(recipe=m.recipe, level=m.level)
                    for m in data.meals
                ],
                favorite_berries=data.favorite_berries,
                island_bonus=data.island_bonus,
            )
        )
        return TeamProductionOut(
            member_count=result.member_count,
            excluded_count=result.excluded_count,
            total_strength=result.total_strength,
            total_berry_amount=result.total_berry_amount,
            total_berry_strength=result.total_berry_strength,
            total_skill_strength=result.total_skill_strength,
            total_strength_base=result.total_strength_base,
            total_berry_strength_base=result.total_berry_strength_base,
            total_skill_strength_base=result.total_skill_strength_base,
            island_bonus=result.island_bonus,
            ingredients=[
                SlotProductionOut(ingredient=s.ingredient, amount=s.amount)
                for s in result.ingredients
            ],
            total_ingredients=result.total_ingredients,
            skill_triggers=result.skill_triggers,
            skill_energy=result.skill_energy,
            skill_self_energy=result.skill_self_energy,
            skill_dream_shards=result.skill_dream_shards,
            skill_tasty_chance=result.skill_tasty_chance,
            skill_extra_helpful=result.skill_extra_helpful,
            skill_random_energy=result.skill_random_energy,
            skill_cooking_ingredients=result.skill_cooking_ingredients,
            skill_ingredient_total=result.skill_ingredient_total,
            extra_tasty_rate=result.extra_tasty_rate,
            extra_tasty_multiplier=result.extra_tasty_multiplier,
            skill_effects=[
                SkillEffectAggOut(kind=e.kind, total=e.total, triggers=e.triggers)
                for e in result.skill_effects
            ],
            members=[
                MemberContributionOut(
                    member_id=m.member_id,
                    species=m.species,
                    strength=m.strength,
                    strength_base=m.strength_base,
                    berry_amount=m.berry_amount,
                    ingredients_total=m.ingredients_total,
                    skill_triggers=m.skill_triggers,
                    production=_full_production_out(m.production),
                )
                for m in result.members
            ],
            cooking_strength=result.cooking_strength,
            cooking_strength_base=result.cooking_strength_base,
            cooking_ingredients=[
                IngredientBalanceOut(
                    ingredient=b.ingredient,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in result.cooking_ingredients
            ],
            cooking_surplus=[
                IngredientBalanceOut(
                    ingredient=b.ingredient,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in result.cooking_surplus
            ],
            cooking_meals=[
                MealFeasibilityOut(
                    recipe_name=m.recipe_name,
                    met=m.met,
                    level=m.level,
                    strength=m.strength,
                    ingredients=[
                        SlotIngredientStatusOut(
                            ingredient=si.ingredient,
                            required=si.required,
                            available=si.available,
                        )
                        for si in m.ingredients
                    ],
                )
                for m in result.cooking_meals
            ],
            grand_total_strength=result.grand_total_strength,
            grand_total_strength_base=result.grand_total_strength_base,
        )
