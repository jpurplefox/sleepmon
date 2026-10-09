"""Controllers Litestar: traducen HTTP ↔ DTO y delegan en la aplicación."""

from __future__ import annotations

from uuid import UUID

from litestar import Controller, delete, get, patch, post, put
from litestar.di import NamedDependency
from litestar.params import FromPath
from litestar.status_codes import HTTP_200_OK, HTTP_201_CREATED

from sleepmon.adapters.inbound.http.guards import require_user
from sleepmon.adapters.inbound.http.schemas import (
    BerrySourceOut,
    BerryYieldOut,
    CatalogOut,
    DistributionsOut,
    ExpertSpeedOut,
    FillerOut,
    IngredientBalanceOut,
    IngredientCountOut,
    IslandOut,
    KitchenOut,
    MealFeasibilityOut,
    MemberContributionOut,
    MemberIn,
    MemberOut,
    MemberProductionOut,
    NatureOut,
    PotOut,
    ProductionIn,
    ProductionOut,
    ProgressOut,
    ProgressPatchIn,
    RatingOut,
    RecipeOut,
    SavedSlotOut,
    SavedTeamIn,
    SavedTeamOut,
    SavedTeamRenameIn,
    SkillEffectAggOut,
    SleepIn,
    SleepOut,
    SleepSessionOut,
    SlotIngredientStatusOut,
    SlotProductionOut,
    SpeciesOut,
    SubSkillOut,
    TeamBerryRowOut,
    TeamProductionIn,
    TeamProductionOut,
)
from sleepmon.application.dto import (
    EventEffectInput,
    MealSelectionInput,
    MemberProduction,
    ProductionInput,
    ProductionResult,
    ProgressPatchInput,
    SavedSlotInput,
    SavedTeamInput,
    SleepInput,
    SlotEntryInput,
    SlotInput,
    TeamMemberInput,
    TeamProductionInput,
)
from sleepmon.application.progress_service import PlayerProgressService
from sleepmon.application.saved_team_service import SavedTeamService
from sleepmon.application.services import ProductionService, TeamService
from sleepmon.domain.catalog_data import (
    EXPERT_SPEED_FACTORS,
    INGREDIENT_STRENGTH,
    ISLAND_EXPERT,
    ISLAND_FAVORITE_BERRIES,
    ISLAND_RATING_THRESHOLDS,
    ISLAND_USER_PICKS,
    NATURE_EFFECTS,
    POT_LADDER,
    RECIPE_LEVEL_BONUS,
    SUB_SKILL_TIERS,
)
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.ports import SpeciesCatalog
from sleepmon.domain.progress import PlayerProgress
from sleepmon.domain.saved_team import SavedTeam
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
        effective_skill_level=result.effective_skill_level,
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
        sleep_sessions=[
            SleepSessionOut(
                kind=s.kind,
                hours=s.hours,
                overflow_hours=s.overflow_hours,
                skill_chances=s.skill_chances,
            )
            for s in result.sleep_sessions
        ],
        inventory=result.inventory,
        inventory_fill_hours=result.inventory_fill_hours,
        skill_berry_amount=result.skill_berry_amount,
        skill_berry_strength=result.skill_berry_strength,
        skill_berries_per_teammate=result.skill_berries_per_teammate,
        skill_help_targets=result.skill_help_targets,
        skill_candy=result.skill_candy,
        skill_berry_juice=result.skill_berry_juice,
        skill_energy_drain=result.skill_energy_drain,
        teammate_berries=(
            None
            if result.teammate_berries is None
            else [
                BerryYieldOut(berry=y.berry, amount=y.amount, strength=y.strength)
                for y in result.teammate_berries
            ]
        ),
        teammate_ingredients=(
            None
            if result.teammate_ingredients is None
            else [
                SlotProductionOut(ingredient=s.ingredient, amount=s.amount)
                for s in result.teammate_ingredients
            ]
        ),
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
        skill_berry_amount=production.skill_berry_amount,
        skill_berries_per_teammate=production.skill_berries_per_teammate,
        skill_help_targets=production.skill_help_targets,
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


def _sleep_input(data: SleepIn | None) -> SleepInput | None:
    return None if data is None else SleepInput(data.night_minutes, data.nap_minutes)


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
    guards = [require_user]

    @get("/", sync_to_thread=True)
    def list_members(
        self, service: NamedDependency[TeamService], current_user_id: NamedDependency[UUID]
    ) -> list[MemberOut]:
        return [_to_out(m, p) for m, p in service.list_members_with_production(current_user_id)]

    @post("/", status_code=HTTP_201_CREATED, sync_to_thread=True)
    def add_member(
        self,
        service: NamedDependency[TeamService],
        current_user_id: NamedDependency[UUID],
        data: MemberIn,
    ) -> MemberOut:
        return _to_out(service.add_member(current_user_id, _to_input(data)))

    @get("/distributions", sync_to_thread=True)
    def distributions(
        self, service: NamedDependency[TeamService], current_user_id: NamedDependency[UUID]
    ) -> DistributionsOut:
        dist = service.distributions(current_user_id)
        return DistributionsOut(
            natures=dist.natures,
            ingredients=dist.ingredients,
            sub_skills=dist.sub_skills,
            nature_stats=dist.nature_stats,
        )

    @get("/{member_id:uuid}", sync_to_thread=True)
    def get_member(
        self,
        service: NamedDependency[TeamService],
        current_user_id: NamedDependency[UUID],
        member_id: FromPath[UUID],
    ) -> MemberOut:
        return _to_out(service.get_member(current_user_id, member_id))

    @put("/{member_id:uuid}", sync_to_thread=True)
    def update_member(
        self,
        service: NamedDependency[TeamService],
        current_user_id: NamedDependency[UUID],
        member_id: FromPath[UUID],
        data: MemberIn,
    ) -> MemberOut:
        return _to_out(service.update_member(current_user_id, member_id, _to_input(data)))

    @delete("/{member_id:uuid}", sync_to_thread=True)
    def delete_member(
        self,
        service: NamedDependency[TeamService],
        current_user_id: NamedDependency[UUID],
        member_id: FromPath[UUID],
    ) -> None:
        service.delete_member(current_user_id, member_id)


class ProductionController(Controller):
    path = "/production"

    @post("/", status_code=HTTP_200_OK, sync_to_thread=True)
    def compute(
        self, production_service: NamedDependency[ProductionService], data: ProductionIn
    ) -> ProductionOut:
        result = production_service.compute_production(
            ProductionInput(
                species=data.species,
                level=data.level,
                ingredients=data.ingredients,
                nature=data.nature,
                sub_skills=data.sub_skills,
                ribbon=data.ribbon,
                skill_level=data.skill_level,
                island=data.island,
                favorite_berries=data.favorite_berries,
                main_favorite=data.main_favorite,
                weekly_bonus=data.weekly_bonus,
                sleep=_sleep_input(data.sleep),
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
            pot_ladder=list(POT_LADDER),
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
                    expert=island in ISLAND_EXPERT,
                    ratings=[
                        RatingOut(
                            tier=r.tier.value,
                            level=r.level,
                            required_strength=r.required_strength,
                        )
                        for r in ISLAND_RATING_THRESHOLDS[island]
                    ],
                    expert_speed=(
                        ExpertSpeedOut(main=speed.main, penalty=speed.penalty)
                        if (speed := EXPERT_SPEED_FACTORS.get(island)) is not None
                        else None
                    ),
                )
                for island in Island
            ],
        )


class RecipeController(Controller):
    path = "/recipes"

    @get("/", sync_to_thread=False)
    def list_recipes(
        self, production_service: NamedDependency[ProductionService]
    ) -> list[RecipeOut]:
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
            for r in production_service.list_recipes()
        ]


class TeamProductionController(Controller):
    path = "/teams/production"

    @post("/", status_code=HTTP_200_OK, sync_to_thread=True)
    def compute(
        self,
        production_service: NamedDependency[ProductionService],
        data: TeamProductionIn,
    ) -> TeamProductionOut:
        result = production_service.compute_team_production(
            TeamProductionInput(
                slots=[
                    SlotInput(
                        entries=[
                            SlotEntryInput(
                                id=e.id,
                                pokemon=ProductionInput(
                                    species=e.pokemon.species,
                                    level=e.pokemon.level,
                                    ingredients=e.pokemon.ingredients,
                                    nature=e.pokemon.nature,
                                    sub_skills=e.pokemon.sub_skills,
                                    ribbon=e.pokemon.ribbon,
                                    skill_level=e.pokemon.skill_level,
                                ),
                                weight=e.weight,
                            )
                            for e in s.entries
                        ]
                    )
                    for s in data.slots
                ],
                meals=[
                    None if m is None else MealSelectionInput(recipe=m.recipe, level=m.level)
                    for m in data.meals
                ],
                favorite_berries=data.favorite_berries,
                island=data.island,
                main_favorite=data.main_favorite,
                weekly_bonus=data.weekly_bonus,
                island_bonus=data.island_bonus,
                good_camp_ticket=data.good_camp_ticket,
                pot_size=data.pot_size,
                event_effects=[
                    EventEffectInput(kind=e.kind, value=e.value, scope=e.scope, target=e.target)
                    for e in data.event_effects
                ],
                sleep=_sleep_input(data.sleep),
            )
        )
        return TeamProductionOut(
            member_count=result.member_count,
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
                    id=m.id,
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
            kitchen=KitchenOut(
                pot=PotOut(
                    per_meal=result.kitchen.pot.per_meal,
                    skill_per_meal=result.kitchen.pot.skill_per_meal,
                    daily=result.kitchen.pot.daily,
                    base_daily=result.kitchen.pot.base_daily,
                    skill_daily=result.kitchen.pot.skill_daily,
                    bonus_daily=result.kitchen.pot.bonus_daily,
                    used_by_recipes=result.kitchen.pot.used_by_recipes,
                    filler_room=result.kitchen.pot.filler_room,
                ),
                fillers=[
                    FillerOut(
                        ingredient=f.ingredient,
                        strength=f.strength,
                        available=f.available,
                        used=f.used,
                        contributed=f.contributed,
                    )
                    for f in result.kitchen.fillers
                ],
                recipe_strength=result.kitchen.recipe_strength,
                recipe_strength_base=result.kitchen.recipe_strength_base,
                filler_strength=result.kitchen.filler_strength,
                filler_strength_base=result.kitchen.filler_strength_base,
                extra_tasty_bonus=result.kitchen.extra_tasty_bonus,
                total=result.kitchen.total,
                total_base=result.kitchen.total_base,
            ),
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
                    strength_base=m.strength_base,
                    fits_pot=m.fits_pot,
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
            berries=[
                TeamBerryRowOut(
                    berry=r.berry,
                    amount=r.amount,
                    strength=r.strength,
                    strength_base=r.strength_base,
                    sources=[
                        BerrySourceOut(
                            kind=s.kind,
                            member_id=s.member_id,
                            species=s.species,
                            amount=s.amount,
                            strength_base=s.strength_base,
                        )
                        for s in r.sources
                    ],
                )
                for r in result.berries
            ],
        )


def _to_progress_out(progress: PlayerProgress) -> ProgressOut:
    return ProgressOut(
        pot_size=progress.pot_size,
        recipe_levels=dict(progress.recipe_levels),
        favorite_recipes={t.value: n for t, n in progress.favorite_recipes.items()},
        area_bonuses={a.value: p for a, p in progress.area_bonuses.items()},
        sleep=SleepOut(
            night_minutes=progress.sleep.night_minutes, nap_minutes=progress.sleep.nap_minutes
        ),
    )


class ProgressController(Controller):
    path = "/progress"
    guards = [require_user]

    @get("/", sync_to_thread=True)
    def get_progress(
        self,
        progress: NamedDependency[PlayerProgressService],
        current_user_id: NamedDependency[UUID],
    ) -> ProgressOut:
        return _to_progress_out(progress.get(current_user_id))

    @patch("/", status_code=HTTP_200_OK, sync_to_thread=True)
    def patch_progress(
        self,
        progress: NamedDependency[PlayerProgressService],
        current_user_id: NamedDependency[UUID],
        data: ProgressPatchIn,
    ) -> ProgressOut:
        return _to_progress_out(
            progress.patch(
                current_user_id,
                ProgressPatchInput(
                    pot_size=data.pot_size,
                    recipe_levels=data.recipe_levels,
                    favorite_recipes=data.favorite_recipes,
                    area_bonuses=data.area_bonuses,
                    sleep=_sleep_input(data.sleep),
                ),
            )
        )


def _saved_team_input(data: SavedTeamIn) -> SavedTeamInput:
    return SavedTeamInput(
        name=data.name,
        slots=[SavedSlotInput(members=tuple(s.members), share=s.share) for s in data.slots],
        weekly_bonus=data.weekly_bonus,
        meals=list(data.meals),
        island=data.island,
        favorite_berries=list(data.favorite_berries),
        main_favorite=data.main_favorite,
        dish_type=data.dish_type,
    )


def _saved_team_out(team: SavedTeam) -> SavedTeamOut:
    return SavedTeamOut(
        id=str(team.id),
        name=team.name,
        slots=[
            SavedSlotOut(members=[str(m) for m in s.members], share=s.share) for s in team.slots
        ],
        island=None if team.island is None else team.island.value,
        favorite_berries=[b.value for b in team.favorite_berries],
        main_favorite=None if team.main_favorite is None else team.main_favorite.value,
        weekly_bonus=team.weekly_bonus.value,
        dish_type=None if team.dish_type is None else team.dish_type.value,
        meals=list(team.meals),
        saved_at=team.saved_at,
    )


class SavedTeamController(Controller):
    path = "/saved-teams"
    guards = [require_user]

    @get("/", sync_to_thread=True)
    def list_teams(
        self,
        saved_teams: NamedDependency[SavedTeamService],
        current_user_id: NamedDependency[UUID],
    ) -> list[SavedTeamOut]:
        return [_saved_team_out(t) for t in saved_teams.list(current_user_id)]

    @post("/", status_code=HTTP_201_CREATED, sync_to_thread=True)
    def create_team(
        self,
        saved_teams: NamedDependency[SavedTeamService],
        current_user_id: NamedDependency[UUID],
        data: SavedTeamIn,
    ) -> SavedTeamOut:
        return _saved_team_out(saved_teams.create(current_user_id, _saved_team_input(data)))

    @put("/{team_id:uuid}", sync_to_thread=True)
    def replace_team(
        self,
        saved_teams: NamedDependency[SavedTeamService],
        current_user_id: NamedDependency[UUID],
        team_id: FromPath[UUID],
        data: SavedTeamIn,
    ) -> SavedTeamOut:
        return _saved_team_out(
            saved_teams.replace(current_user_id, team_id, _saved_team_input(data))
        )

    @patch("/{team_id:uuid}", status_code=HTTP_200_OK, sync_to_thread=True)
    def rename_team(
        self,
        saved_teams: NamedDependency[SavedTeamService],
        current_user_id: NamedDependency[UUID],
        team_id: FromPath[UUID],
        data: SavedTeamRenameIn,
    ) -> SavedTeamOut:
        return _saved_team_out(saved_teams.rename(current_user_id, team_id, data.name))

    @delete("/{team_id:uuid}", sync_to_thread=True)
    def delete_team(
        self,
        saved_teams: NamedDependency[SavedTeamService],
        current_user_id: NamedDependency[UUID],
        team_id: FromPath[UUID],
    ) -> None:
        saved_teams.delete(current_user_id, team_id)
