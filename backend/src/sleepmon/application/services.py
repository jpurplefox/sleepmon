"""Casos de uso del equipo (puerto primario + implementación).

El service depende solo de los puertos ``TeamRepository`` y ``SpeciesCatalog`` (DIP).
Acá vive la validación que cruza el input con el catálogo: que la especie exista,
que naturaleza/sub skills/ingredientes pertenezcan a los conjuntos cerrados, y que
cada ingrediente sea válido para la especie en su slot.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from enum import StrEnum
from typing import TypeVar
from uuid import UUID

from sleepmon.application.dto import (
    Distributions,
    IngredientBalanceDTO,
    IngredientCountDTO,
    MealFeasibilityDTO,
    MemberContributionDTO,
    MemberProduction,
    ProductionInput,
    ProductionResult,
    RecipeDTO,
    SlotAmount,
    TeamMemberInput,
    TeamProductionInput,
    TeamProductionResult,
)
from sleepmon.domain import analytics
from sleepmon.domain.analytics import team_production
from sleepmon.domain.catalog_data import MAX_RECIPE_LEVEL
from sleepmon.domain.cooking import MealSelection, plan_cooking
from sleepmon.domain.entities import (
    TeamMember,
    validate_ingredient_count,
    validate_level,
    validate_skill_level,
    validate_sub_skills,
)
from sleepmon.domain.errors import SpeciesNotFoundError, TeamMemberNotFoundError, ValidationError
from sleepmon.domain.ports import RecipeCatalog, SpeciesCatalog, TeamRepository
from sleepmon.domain.production import DailyProduction, daily_production
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill

E = TypeVar("E", bound=StrEnum)


def _parse_enum(enum_cls: type[E], value: str, field: str) -> E:
    try:
        return enum_cls(value)
    except ValueError as exc:
        valid = ", ".join(e.value for e in enum_cls)
        raise ValidationError(f"{field} inválido: {value!r}. Opciones: {valid}.") from exc


def _validate_ingredients(species: Species, ingredients: tuple[Ingredient, ...]) -> None:
    """Valida que cada ingrediente sea posible para la especie en su slot."""
    slot_count = len(species.ingredient_slots)
    for slot, ingredient in enumerate(ingredients):
        if slot >= slot_count:
            raise ValidationError(f"{species.name} solo tiene {slot_count} slots de ingrediente.")
        if not species.allows_ingredient(slot, ingredient):
            allowed = ", ".join(i.value for i in species.ingredient_slots[slot])
            raise ValidationError(
                f"{ingredient.value} no es válido para {species.name} en el slot "
                f"{slot + 1}. Válidos: {allowed}."
            )


class TeamService(ABC):
    """Puerto primario: lo que el borde HTTP puede pedirle a la aplicación."""

    @abstractmethod
    def add_member(self, data: TeamMemberInput) -> TeamMember: ...

    @abstractmethod
    def get_member(self, member_id: UUID) -> TeamMember: ...

    @abstractmethod
    def list_members(self) -> list[TeamMember]: ...

    @abstractmethod
    def list_members_with_production(
        self,
    ) -> list[tuple[TeamMember, MemberProduction | None]]: ...

    @abstractmethod
    def update_member(self, member_id: UUID, data: TeamMemberInput) -> TeamMember: ...

    @abstractmethod
    def delete_member(self, member_id: UUID) -> None: ...

    @abstractmethod
    def distributions(self) -> Distributions: ...

    @abstractmethod
    def compute_production(self, data: ProductionInput) -> ProductionResult: ...

    @abstractmethod
    def list_recipes(self) -> list[RecipeDTO]: ...

    @abstractmethod
    def compute_team_production(self, data: TeamProductionInput) -> TeamProductionResult: ...


class DefaultTeamService(TeamService):
    def __init__(
        self,
        repository: TeamRepository,
        catalog: SpeciesCatalog,
        recipe_catalog: RecipeCatalog,
    ) -> None:
        self._repo = repository
        self._catalog = catalog
        self._recipes = recipe_catalog

    def add_member(self, data: TeamMemberInput) -> TeamMember:
        member = self._build_member(data)
        self._repo.add(member)
        return member

    def get_member(self, member_id: UUID) -> TeamMember:
        member = self._repo.get(member_id)
        if member is None:
            raise TeamMemberNotFoundError(str(member_id))
        return member

    def list_members(self) -> list[TeamMember]:
        return self._repo.list()

    def list_members_with_production(
        self,
    ) -> list[tuple[TeamMember, MemberProduction | None]]:
        # Overview de la caja: producción por miembro reutilizando el cálculo del
        # dominio (el mismo que /production). El miembro ya está validado (sus enums
        # vienen del repo), así que no re-parseamos ni re-validamos.
        return [(m, self._member_production(m)) for m in self._repo.list()]

    def _member_production(self, member: TeamMember) -> MemberProduction | None:
        species = self._catalog.get(member.species)
        if species is None:  # especie fuera del catálogo curado: sin producción
            return None
        result = daily_production(
            species,
            member.ingredients,
            member.level,
            member.nature,
            member.sub_skills,
            member.ribbon,
            member.skill_level,
        )
        return MemberProduction(
            berries=result.berry_amount,
            berry_strength=result.berry_strength,
            ingredients=[
                SlotAmount(ingredient=slot.ingredient.value, amount=slot.amount)
                for slot in result.ingredients
            ],
            ingredients_total=sum(slot.amount for slot in result.ingredients),
            skill_triggers=result.skill_triggers,
            skill_ingredients=[
                SlotAmount(ingredient=slot.ingredient.value, amount=slot.amount)
                for slot in result.skill_ingredients
            ],
            skill_ingredient_total=result.skill_ingredient_total,
            skill_energy=result.skill_energy,
            skill_cooking_ingredients=result.skill_cooking_ingredients,
            skill_strength=result.skill_strength,
            skill_self_energy=result.skill_self_energy,
            skill_dream_shards=result.skill_dream_shards,
            skill_tasty_chance=result.skill_tasty_chance,
            skill_extra_helpful=result.skill_extra_helpful,
            skill_random_energy=result.skill_random_energy,
        )

    def update_member(self, member_id: UUID, data: TeamMemberInput) -> TeamMember:
        # Preservamos el id; reconstruimos el resto para revalidar todo.
        member = self._build_member(data, member_id=member_id)
        if not self._repo.update(member):
            raise TeamMemberNotFoundError(str(member_id))
        return member

    def delete_member(self, member_id: UUID) -> None:
        if not self._repo.delete(member_id):
            raise TeamMemberNotFoundError(str(member_id))

    def distributions(self) -> Distributions:
        members = self._repo.list()
        return Distributions(
            natures={k.value: v for k, v in analytics.nature_distribution(members).items()},
            ingredients={k.value: v for k, v in analytics.ingredient_distribution(members).items()},
            sub_skills={k.value: v for k, v in analytics.sub_skill_distribution(members).items()},
            nature_stats={k.value: v for k, v in analytics.nature_stat_balance(members).items()},
        )

    def compute_production(self, data: ProductionInput) -> ProductionResult:
        # Stateless: no toca el repo, así sirve igual para un Pokémon de la caja o
        # uno armado desde cero.
        species = self._catalog.get(data.species)
        if species is None:
            raise SpeciesNotFoundError(f"Especie desconocida: {data.species!r}.")

        ingredients = tuple(_parse_enum(Ingredient, i, "ingredient") for i in data.ingredients)
        nature = _parse_enum(Nature, data.nature, "nature") if data.nature else None
        sub_skills = tuple(_parse_enum(SubSkill, s, "sub_skill") for s in data.sub_skills)
        ribbon = _parse_enum(Ribbon, data.ribbon, "ribbon")

        # Mismas invariantes de miembro que add_member/update_member (que las aplican
        # vía el constructor de TeamMember): nivel entero en rango, nivel de skill en
        # rango, exactamente un ingrediente por slot y sub skills sin repetir dentro del
        # tope. compute_production no construye un TeamMember, así que las reusa
        # explícitamente para no divergir.
        validate_level(data.level)
        validate_skill_level(data.skill_level)
        validate_ingredient_count(ingredients)
        validate_sub_skills(sub_skills)
        _validate_ingredients(species, ingredients)

        result = daily_production(
            species, ingredients, data.level, nature, sub_skills, ribbon, data.skill_level
        )
        return ProductionResult(
            helps_per_day=result.helps_per_day,
            seconds_per_help=result.seconds_per_help,
            berry=result.berry.value,
            berry_amount=result.berry_amount,
            berry_strength=result.berry_strength,
            berry_percentage=result.berry_percentage,
            ingredient_percentage=result.ingredient_percentage,
            skill_percentage=result.skill_percentage,
            effective_skill_percentage=result.effective_skill_percentage,
            ingredients=[
                SlotAmount(ingredient=slot.ingredient.value, amount=slot.amount)
                for slot in result.ingredients
            ],
            skill_triggers=result.skill_triggers,
            skill_ingredients=[
                SlotAmount(ingredient=slot.ingredient.value, amount=slot.amount)
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
            night_skill_chances=list(result.night_skill_chances),
            inventory=result.inventory,
            inventory_fill_hours=result.inventory_fill_hours,
        )

    def list_recipes(self) -> list[RecipeDTO]:
        return [
            RecipeDTO(
                name=r.name,
                type=r.type.value,
                ingredients=[
                    IngredientCountDTO(ingredient=ing.value, count=count)
                    for ing, count in r.ingredients
                ],
                base_strength=r.base_strength,
            )
            for r in self._recipes.all()
        ]

    _MAX_TEAM = 5

    def compute_team_production(self, data: TeamProductionInput) -> TeamProductionResult:
        # Validación de la selección: 1..5 ids, sin duplicados.
        if not 1 <= len(data.member_ids) <= self._MAX_TEAM:
            raise ValidationError(
                f"Un equipo tiene entre 1 y {self._MAX_TEAM} miembros; llegaron "
                f"{len(data.member_ids)}."
            )
        if len(set(data.member_ids)) != len(data.member_ids):
            raise ValidationError("Un equipo no puede repetir miembros.")

        # Cargar miembros (404 si falta) y computar su producción. Los miembros con
        # especie fuera del catálogo curado se excluyen del agregado.
        entries: list[tuple[str, str, DailyProduction]] = []
        excluded = 0
        for raw_id in data.member_ids:
            try:
                member_uuid = UUID(raw_id)
            except ValueError as exc:
                raise ValidationError(f"Id de miembro inválido: {raw_id!r}.") from exc
            member = self.get_member(member_uuid)  # levanta TeamMemberNotFoundError
            species = self._catalog.get(member.species)
            if species is None:
                excluded += 1
                continue
            daily = daily_production(
                species,
                member.ingredients,
                member.level,
                member.nature,
                member.sub_skills,
                member.ribbon,
                member.skill_level,
            )
            entries.append((str(member.id), member.species, daily))

        aggregate = team_production(entries)

        # Cocina: resolver cada comida (receta + nivel) contra el catálogo.
        meals: list[MealSelection | None] = []
        for meal in data.meals:
            if meal is None:
                meals.append(None)
                continue
            recipe = self._recipes.get(meal.recipe)
            if recipe is None:
                raise ValidationError(f"Receta desconocida: {meal.recipe!r}.")
            if not 1 <= meal.level <= MAX_RECIPE_LEVEL:
                raise ValidationError(
                    f"El nivel de receta debe estar entre 1 y {MAX_RECIPE_LEVEL}; "
                    f"llegó {meal.level}."
                )
            meals.append(MealSelection(recipe=recipe, level=meal.level))

        cooking = plan_cooking(meals, aggregate.ingredients)

        return TeamProductionResult(
            member_count=aggregate.member_count,
            excluded_count=excluded,
            total_strength=aggregate.total_strength,
            total_berry_amount=aggregate.total_berry_amount,
            total_berry_strength=aggregate.total_berry_strength,
            total_skill_strength=aggregate.total_skill_strength,
            ingredients=[
                SlotAmount(ingredient=ing.value, amount=amount)
                for ing, amount in aggregate.ingredients.items()
            ],
            total_ingredients=aggregate.total_ingredients,
            skill_triggers=aggregate.skill_triggers,
            skill_energy=aggregate.skill_energy,
            skill_self_energy=aggregate.skill_self_energy,
            skill_dream_shards=aggregate.skill_dream_shards,
            skill_tasty_chance=aggregate.skill_tasty_chance,
            skill_extra_helpful=aggregate.skill_extra_helpful,
            skill_random_energy=aggregate.skill_random_energy,
            skill_cooking_ingredients=aggregate.skill_cooking_ingredients,
            skill_ingredient_total=aggregate.skill_ingredient_total,
            members=[
                MemberContributionDTO(
                    member_id=m.member_id,
                    species=m.species,
                    strength=m.strength,
                    berry_amount=m.berry_amount,
                    ingredients_total=m.ingredients_total,
                    skill_triggers=m.skill_triggers,
                )
                for m in aggregate.members
            ],
            cooking_strength=cooking.cooking_strength,
            cooking_ingredients=[
                IngredientBalanceDTO(
                    ingredient=b.ingredient.value,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in cooking.ingredients
            ],
            cooking_surplus=[
                IngredientBalanceDTO(
                    ingredient=b.ingredient.value,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in cooking.surplus
            ],
            cooking_meals=[
                MealFeasibilityDTO(recipe_name=s.recipe_name, met=s.met) for s in cooking.slots
            ],
            grand_total_strength=aggregate.total_strength + cooking.cooking_strength,
        )

    def _build_member(self, data: TeamMemberInput, member_id: UUID | None = None) -> TeamMember:
        species = self._catalog.get(data.species)
        if species is None:
            raise SpeciesNotFoundError(f"Especie desconocida: {data.species!r}.")

        nature = _parse_enum(Nature, data.nature, "nature") if data.nature else None
        sub_skills = tuple(_parse_enum(SubSkill, s, "sub_skill") for s in data.sub_skills)
        ribbon = _parse_enum(Ribbon, data.ribbon, "ribbon")
        ingredients = tuple(_parse_enum(Ingredient, i, "ingredient") for i in data.ingredients)

        _validate_ingredients(species, ingredients)

        # El constructor de TeamMember aplica las invariantes absolutas (rango de
        # nivel, topes MAX_INGREDIENTS/MAX_SUB_SKILLS, sub skills sin repetir). NO
        # acota por nivel: un miembro lleva todos sus ingredientes/sub skills ya
        # definidos desde nivel 1 (en el juego quedan inactivos hasta su nivel de
        # desbloqueo, pero el dato se guarda completo).
        if member_id is None:
            return TeamMember(
                species=species.name,
                level=data.level,
                nature=nature,
                ingredients=ingredients,
                sub_skills=sub_skills,
                ribbon=ribbon,
                skill_level=data.skill_level,
            )
        return TeamMember(
            id=member_id,
            species=species.name,
            level=data.level,
            nature=nature,
            ingredients=ingredients,
            sub_skills=sub_skills,
            ribbon=ribbon,
            skill_level=data.skill_level,
        )
