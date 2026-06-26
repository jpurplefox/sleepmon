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
    MemberIn,
    MemberOut,
    NatureOut,
    ProductionIn,
    ProductionOut,
    SlotProductionOut,
    SpeciesOut,
    SubSkillOut,
)
from sleepmon.application.dto import ProductionInput, TeamMemberInput
from sleepmon.application.services import TeamService
from sleepmon.domain.catalog_data import NATURE_EFFECTS, SUB_SKILL_TIERS
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.ports import SpeciesCatalog
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill


def _to_out(member: TeamMember) -> MemberOut:
    return MemberOut(
        id=str(member.id),
        species=member.species,
        level=member.level,
        nature=member.nature.value if member.nature else "",
        ingredients=[i.value for i in member.ingredients],
        sub_skills=[s.value for s in member.sub_skills],
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
    )


class TeamController(Controller):
    path = "/team"

    @get("/", sync_to_thread=True)
    def list_members(self, service: NamedDependency[TeamService]) -> list[MemberOut]:
        return [_to_out(m) for m in service.list_members()]

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
            )
        )
        return ProductionOut(
            helps_per_day=result.helps_per_day,
            seconds_per_help=result.seconds_per_help,
            berry=result.berry,
            berry_amount=result.berry_amount,
            berry_percentage=result.berry_percentage,
            ingredient_percentage=result.ingredient_percentage,
            skill_percentage=result.skill_percentage,
            effective_skill_percentage=result.effective_skill_percentage,
            ingredients=[
                SlotProductionOut(ingredient=slot.ingredient, amount=slot.amount)
                for slot in result.ingredients
            ],
            skill_triggers=result.skill_triggers,
            night_skill_chances=result.night_skill_chances,
            inventory=result.inventory,
            inventory_fill_hours=result.inventory_fill_hours,
        )


class CatalogController(Controller):
    path = "/catalog"

    @get("/", sync_to_thread=False)
    def get_catalog(self, catalog: NamedDependency[SpeciesCatalog]) -> CatalogOut:
        return CatalogOut(
            natures=[_nature_out(n) for n in Nature],
            sub_skills=[SubSkillOut(name=s.value, tier=SUB_SKILL_TIERS[s].value) for s in SubSkill],
            ingredients=[i.value for i in Ingredient],
            species=[
                SpeciesOut(
                    name=sp.name,
                    dex=sp.dex,
                    specialty=sp.specialty.value,
                    berry=sp.berry.value,
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
        )
