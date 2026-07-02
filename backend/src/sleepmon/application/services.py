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
    SkillEffectAggDTO,
    SlotAmount,
    SlotIngredientStatusDTO,
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
from sleepmon.domain.production import DailyProduction, daily_production, scale_daily
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Berry, Ingredient, Nature, Ribbon, SubSkill

E = TypeVar("E", bound=StrEnum)


def _production_result(daily: DailyProduction) -> ProductionResult:
    """Convierte un ``DailyProduction`` del dominio a ``ProductionResult`` (DTO).

    Función compartida entre ``compute_production`` y ``compute_team_production``
    para que ambas produzcan exactamente la misma forma, sin duplicar el mapping.
    """
    return ProductionResult(
        helps_per_day=daily.helps_per_day,
        seconds_per_help=daily.seconds_per_help,
        berry=daily.berry.value,
        berry_amount=daily.berry_amount,
        berry_strength=daily.berry_strength,
        berry_percentage=daily.berry_percentage,
        ingredient_percentage=daily.ingredient_percentage,
        skill_percentage=daily.skill_percentage,
        effective_skill_percentage=daily.effective_skill_percentage,
        ingredients=[
            SlotAmount(ingredient=slot.ingredient.value, amount=slot.amount)
            for slot in daily.ingredients
        ],
        skill_triggers=daily.skill_triggers,
        skill_ingredients=[
            SlotAmount(ingredient=slot.ingredient.value, amount=slot.amount)
            for slot in daily.skill_ingredients
        ],
        skill_energy=daily.skill_energy,
        skill_ingredient_total=daily.skill_ingredient_total,
        skill_cooking_ingredients=daily.skill_cooking_ingredients,
        skill_strength=daily.skill_strength,
        skill_self_energy=daily.skill_self_energy,
        skill_dream_shards=daily.skill_dream_shards,
        skill_tasty_chance=daily.skill_tasty_chance,
        skill_extra_helpful=daily.skill_extra_helpful,
        skill_random_energy=daily.skill_random_energy,
        night_skill_chances=list(daily.night_skill_chances),
        inventory=daily.inventory,
        inventory_fill_hours=daily.inventory_fill_hours,
    )


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
        return _production_result(result)

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
    _WEIGHT_EPS = 1e-6

    def compute_team_production(self, data: TeamProductionInput) -> TeamProductionResult:
        # Validación de la selección: 1..5 slots; cada slot 1..2 entradas; pesos de
        # un slot suman 1.0; sin miembros repetidos en todo el equipo.
        if not 1 <= len(data.slots) <= self._MAX_TEAM:
            raise ValidationError(
                f"Un equipo tiene entre 1 y {self._MAX_TEAM} slots; llegaron "
                f"{len(data.slots)}."
            )
        flat: list[tuple[str, float]] = []
        seen: set[str] = set()
        for slot in data.slots:
            if not 1 <= len(slot.entries) <= 2:
                raise ValidationError("Un slot tiene 1 o 2 Pokémon.")
            total_weight = 0.0
            for entry in slot.entries:
                if not 0.0 < entry.weight <= 1.0:
                    raise ValidationError(
                        f"El peso de un Pokémon debe estar en (0, 1]; llegó "
                        f"{entry.weight}."
                    )
                if entry.member_id in seen:
                    raise ValidationError("Un equipo no puede repetir Pokémon.")
                seen.add(entry.member_id)
                total_weight += entry.weight
                flat.append((entry.member_id, entry.weight))
            if len(slot.entries) > 1 and abs(total_weight - 1.0) > self._WEIGHT_EPS:
                raise ValidationError("Los pesos de un slot deben sumar 1.")

        if not 0.0 <= data.island_bonus <= 0.85:
            raise ValidationError(
                f"El bonus de isla debe estar entre 0 y 0.85; llegó {data.island_bonus}."
            )
        if len(data.favorite_berries) > 3:
            raise ValidationError("Como máximo 3 bayas favoritas.")
        if len(set(data.favorite_berries)) != len(data.favorite_berries):
            raise ValidationError("Las bayas favoritas no pueden repetirse.")
        favorites: set[Berry] = set()
        for name in data.favorite_berries:
            try:
                favorites.add(Berry(name))
            except ValueError as exc:
                raise ValidationError(f"Baya desconocida: {name!r}.") from exc
        favorite_frozen = frozenset(favorites)

        # Cargar miembros (404 si falta) y computar su producción escalada por peso.
        # Los miembros con especie fuera del catálogo curado se excluyen del agregado.
        entries: list[tuple[str, str, DailyProduction]] = []
        member_productions: dict[str, ProductionResult] = {}
        excluded = 0
        for raw_id, weight in flat:
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
                favorite_berries=favorite_frozen,
                good_camp_ticket=data.good_camp_ticket,
            )
            scaled = scale_daily(daily, weight)
            member_id_str = str(member.id)
            member_productions[member_id_str] = _production_result(scaled)
            entries.append((member_id_str, member.species, scaled))

        aggregate = team_production(entries, island_bonus=data.island_bonus)

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

        factor = 1.0 + data.island_bonus
        cooking_strength = cooking.cooking_strength * factor

        return TeamProductionResult(
            member_count=aggregate.member_count,
            excluded_count=excluded,
            total_strength=aggregate.total_strength,
            total_berry_amount=aggregate.total_berry_amount,
            total_berry_strength=aggregate.total_berry_strength,
            total_skill_strength=aggregate.total_skill_strength,
            total_strength_base=aggregate.total_strength_base,
            total_berry_strength_base=aggregate.total_berry_strength_base,
            total_skill_strength_base=aggregate.total_skill_strength_base,
            island_bonus=data.island_bonus,
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
            extra_tasty_rate=aggregate.extra_tasty_rate,
            extra_tasty_multiplier=aggregate.extra_tasty_multiplier,
            skill_effects=[
                SkillEffectAggDTO(kind=e.kind, total=e.total, triggers=e.triggers)
                for e in aggregate.skill_effects
            ],
            members=[
                MemberContributionDTO(
                    member_id=m.member_id,
                    species=m.species,
                    strength=m.strength,
                    strength_base=m.strength_base,
                    berry_amount=m.berry_amount,
                    ingredients_total=m.ingredients_total,
                    skill_triggers=m.skill_triggers,
                    production=member_productions[m.member_id],
                )
                for m in aggregate.members
            ],
            cooking_strength=cooking_strength,
            cooking_strength_base=cooking.cooking_strength,
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
                MealFeasibilityDTO(
                    recipe_name=s.recipe_name,
                    met=s.met,
                    level=s.level,
                    strength=s.strength,
                    ingredients=[
                        SlotIngredientStatusDTO(
                            ingredient=si.ingredient.value,
                            required=si.required,
                            available=si.available,
                        )
                        for si in s.ingredients
                    ],
                )
                for s in cooking.slots
            ],
            grand_total_strength=aggregate.total_strength + cooking_strength,
            grand_total_strength_base=aggregate.total_strength_base + cooking.cooking_strength,
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
