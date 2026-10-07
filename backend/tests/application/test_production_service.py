import math

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.dto import (
    BerrySourceDTO,
    EventEffectInput,
    MealSelectionInput,
    ProductionInput,
    SleepInput,
    SlotEntryInput,
    SlotInput,
    TeamProductionInput,
    TeamProductionResult,
)
from sleepmon.application.services import DefaultProductionService
from sleepmon.domain.catalog_data import MAX_RECIPE_LEVEL
from sleepmon.domain.errors import SpeciesNotFoundError, ValidationError


def _pokemon(**overrides: object) -> ProductionInput:
    defaults: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": "Adamant",
        "ingredients": ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        "sub_skills": ["Helping Speed S"],
    }
    defaults.update(overrides)
    return ProductionInput(**defaults)  # type: ignore[arg-type]


def _entry(entry_id: str, weight: float = 1.0, **overrides: object) -> SlotEntryInput:
    return SlotEntryInput(id=entry_id, pokemon=_pokemon(**overrides), weight=weight)


def _slots(*ids: str) -> list[SlotInput]:
    """One single-Pokémon slot per id, all with the same config."""
    return [SlotInput(entries=[_entry(i)]) for i in ids]


@pytest.fixture
def production_service() -> DefaultProductionService:
    return DefaultProductionService(StaticSpeciesCatalog(), StaticRecipeCatalog())


def test_compute_production_returns_estimate(production_service: DefaultProductionService) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Pikachu", level=60, ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"]
        )
    )
    assert result.helps_per_day > 0
    assert result.berry == "Grepa"  # baya de Pikachu
    assert [s.ingredient for s in result.ingredients] == [
        "Fancy Apple",
        "Warming Ginger",
        "Fancy Egg",
    ]


def test_compute_production_only_unlocked_slots_at_low_level(
    production_service: DefaultProductionService,
) -> None:
    # Nivel 1: solo el primer slot de ingrediente desbloqueado.
    result = production_service.compute_production(
        ProductionInput(
            species="Pikachu", level=1, ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"]
        )
    )
    assert [s.ingredient for s in result.ingredients] == ["Fancy Apple"]


def test_compute_production_unknown_species_rejected(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(SpeciesNotFoundError):
        production_service.compute_production(
            ProductionInput(
                species="Mew",
                level=60,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_compute_production_requires_three_ingredients(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(
            ProductionInput(
                species="Pikachu", level=30, ingredients=["Fancy Apple", "Warming Ginger"]
            )
        )


def test_compute_production_invalid_level_rejected(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=0,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_compute_production_rejects_duplicate_sub_skills(
    production_service: DefaultProductionService,
) -> None:
    # Mismas invariantes que add_member: las sub skills repetidas se rechazan (antes
    # se colaban y sesgaban el cálculo sumando el bonus dos veces).
    with pytest.raises(ValidationError, match="repetir"):
        production_service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=80,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
                sub_skills=["Helping Speed M", "Helping Speed M"],
            )
        )


def test_compute_production_rejects_too_many_sub_skills(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=80,
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
                sub_skills=[
                    "Helping Speed M",
                    "Inventory Up S",
                    "Skill Trigger S",
                    "Ingredient Finder S",
                    "Berry Finding S",
                    "Helping Bonus",
                ],  # 6 > 5
            )
        )


def test_compute_production_accepts_nature_and_ribbon(
    production_service: DefaultProductionService,
) -> None:
    # Cubre el parseo de nature y ribbon no-vacíos por la ruta de compute_production
    # (las demás llamadas usan los defaults vacíos).
    result = production_service.compute_production(
        ProductionInput(
            species="Pikachu",
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            nature="Adamant",
            ribbon="500h",
        )
    )
    assert result.helps_per_day > 0


def test_compute_production_rejects_non_int_level(
    production_service: DefaultProductionService,
) -> None:
    # bool es subtipo de int (True == 1): se rechaza igual que en TeamMember.
    with pytest.raises(ValidationError):
        production_service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=True,  # type: ignore[arg-type]
                ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_compute_production_invalid_ingredient_for_slot_rejected(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(
            ProductionInput(
                species="Pikachu",
                level=60,
                ingredients=["Large Leek", "Warming Ginger", "Fancy Egg"],
            )
        )


def test_production_skill_level_out_of_range_rejected(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(
            ProductionInput(
                species="Crustle",
                level=60,
                ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
                skill_level=0,
            )
        )


def test_compute_production_includes_skill_ingredients_for_crustle(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
            skill_level=7,
        )
    )
    pool = {s.ingredient for s in result.skill_ingredients}
    assert pool == {"Glossy Avocado", "Soft Potato", "Pure Oil"}
    expected_each = result.skill_triggers * 18 / 3
    for slot in result.skill_ingredients:
        assert slot.amount == pytest.approx(expected_each)


def test_compute_production_no_skill_ingredients_for_non_draw_species(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Pikachu",
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        )
    )
    assert result.skill_ingredients == []


def test_compute_production_includes_skill_energy_for_sylveon(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Sylveon",
            level=60,
            ingredients=["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            skill_level=6,
        )
    )
    assert result.skill_energy is not None
    assert result.skill_energy == pytest.approx(result.skill_triggers * 18)
    assert result.skill_ingredients == []  # E4E no produce ingredientes


def test_compute_production_no_skill_energy_for_non_e4e(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
            skill_level=7,
        )
    )
    assert result.skill_energy is None


def test_compute_production_includes_skill_ingredient_total_for_magnet(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Bulbasaur",  # Ingredient Magnet S
            level=60,
            ingredients=["Honey", "Snoozy Tomato", "Soft Potato"],
            skill_level=7,
        )
    )
    assert result.skill_ingredient_total is not None
    assert result.skill_ingredient_total == pytest.approx(result.skill_triggers * 24)
    assert result.skill_ingredients == []  # no se desglosa por tipo
    assert result.skill_energy is None


def test_compute_production_no_skill_ingredient_total_for_non_magnet(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
        )
    )
    assert result.skill_ingredient_total is None


def test_compute_production_includes_cooking_ingredients_for_flareon(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Flareon",  # Cooking Power-Up S
            level=60,
            ingredients=["Moomoo Milk", "Soothing Cacao", "Bean Sausage"],
            skill_level=7,
        )
    )
    assert result.skill_cooking_ingredients is not None
    assert result.skill_cooking_ingredients == pytest.approx(result.skill_triggers * 31)
    assert result.skill_ingredients == []
    assert result.skill_energy is None
    assert result.skill_ingredient_total is None


def test_compute_production_includes_skill_strength_for_charge_strength(
    production_service: DefaultProductionService,
) -> None:
    # Pikachu tiene Charge Strength S (monto fijo).
    result = production_service.compute_production(
        ProductionInput(
            species="Pikachu",
            level=60,
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            skill_level=7,
        )
    )
    assert result.skill_strength is not None
    assert result.skill_strength == pytest.approx(result.skill_triggers * 3212)


def test_compute_production_charge_strength_m(production_service: DefaultProductionService) -> None:
    # Mareep tiene Charge Strength M.
    result = production_service.compute_production(
        ProductionInput(
            species="Mareep",
            level=60,
            ingredients=["Fiery Herb", "Fancy Egg", "Fancy Egg"],
            skill_level=7,
        )
    )
    assert result.skill_strength == pytest.approx(result.skill_triggers * 6858)


def test_compute_production_no_skill_strength_for_non_charge(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(
        ProductionInput(
            species="Crustle",
            level=60,
            ingredients=["Glossy Avocado", "Soft Potato", "Pure Oil"],
        )
    )
    assert result.skill_strength is None


def test_compute_production_includes_self_energy_for_charge_energy(
    production_service: DefaultProductionService,
) -> None:
    # Rattata tiene Charge Energy S.
    result = production_service.compute_production(
        ProductionInput(
            species="Rattata",
            level=60,
            ingredients=["Fancy Apple", "Greengrass Soybeans", "Bean Sausage"],
            skill_level=6,
        )
    )
    assert result.skill_self_energy is not None
    assert result.skill_self_energy == pytest.approx(result.skill_triggers * 43)
    assert result.skill_energy is None  # no es energía al equipo


def test_compute_production_includes_dream_shards_for_meowth(
    production_service: DefaultProductionService,
) -> None:
    # Meowth tiene Dream Shard Magnet S (monto fijo). Nivel de skill 8.
    result = production_service.compute_production(
        ProductionInput(
            species="Meowth",
            level=60,
            ingredients=["Moomoo Milk", "Moomoo Milk", "Moomoo Milk"],
            skill_level=8,
        )
    )
    assert result.skill_dream_shards is not None
    assert result.skill_dream_shards == pytest.approx(result.skill_triggers * 2500)


# ---------------------------------------------------------------------------
# compute_team_production
# ---------------------------------------------------------------------------


def test_team_production_accepts_two_identical_configs(
    production_service: DefaultProductionService,
) -> None:
    """Duplicates are two Pokémon: both contribute, so the totals double."""
    one = production_service.compute_team_production(
        TeamProductionInput(
            slots=[SlotInput(entries=[_entry("a")])], meals=[None, None, None]
        )
    )
    two = production_service.compute_team_production(
        TeamProductionInput(
            slots=[
                SlotInput(entries=[_entry("a")]),
                SlotInput(entries=[_entry("b")]),
            ],
            meals=[None, None, None],
        )
    )
    assert two.member_count == 2
    assert two.total_berry_amount == pytest.approx(one.total_berry_amount * 2)


def test_team_production_rejects_repeated_entry_ids(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[
                    SlotInput(entries=[_entry("same")]),
                    SlotInput(entries=[_entry("same")]),
                ],
                meals=[None, None, None],
            )
        )


def test_team_production_rejects_empty_entry_id(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=[_entry("")])], meals=[None, None, None]
            )
        )


def test_team_production_rejects_overlong_entry_id(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=[_entry("x" * 65)])], meals=[None, None, None]
            )
        )


def test_team_production_rejects_unknown_species_in_an_entry(
    production_service: DefaultProductionService,
) -> None:
    """An unknown species is a bad request, not a missing member."""
    with pytest.raises(SpeciesNotFoundError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=[_entry("a", species="Missingno")])],
                meals=[None, None, None],
            )
        )


def test_team_production_contribution_echoes_the_entry_id(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_team_production(
        TeamProductionInput(
            slots=[SlotInput(entries=[_entry("slot-0-a")])], meals=[None, None, None]
        )
    )
    assert [m.id for m in result.members] == ["slot-0-a"]


def test_compute_team_production_split_weights_scale_contribution(
    production_service: DefaultProductionService,
) -> None:
    """A 50/50 slot with two entries: each gets half its solo production."""
    solo = production_service.compute_team_production(
        TeamProductionInput(
            slots=[SlotInput(entries=[_entry("a")])], meals=[None, None, None]
        )
    )
    solo_a = next(m for m in solo.members if m.id == "a")

    # Slot compartido 50/50 entre 'a' y 'b'.
    split = production_service.compute_team_production(
        TeamProductionInput(
            slots=[
                SlotInput(
                    entries=[
                        _entry("a", weight=0.5),
                        _entry("b", weight=0.5),
                    ]
                )
            ],
            meals=[None, None, None],
        )
    )
    split_a = next(m for m in split.members if m.id == "a")

    # weight 0.5 ⇒ la contribución de 'a' es la mitad de su producción solo.
    assert split_a.production.berry_amount == pytest.approx(solo_a.production.berry_amount * 0.5)
    assert split_a.production.berry_strength == pytest.approx(
        solo_a.production.berry_strength * 0.5
    )


def test_compute_team_production_rejects_single_entry_nonunit_weight(
    production_service: DefaultProductionService,
) -> None:
    """Un slot de 1 entrada con peso != 1.0 debe ser rechazado."""
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=[_entry("a", weight=0.5)])],
                meals=[None, None, None],
            )
        )


def test_compute_team_production_rejects_more_than_two_per_slot(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[
                    SlotInput(
                        entries=[
                            _entry("a", weight=0.34),
                            _entry("b", weight=0.33),
                            _entry("c", weight=0.33),
                        ]
                    )
                ],
                meals=[None, None, None],
            )
        )


def test_compute_team_production_rejects_weights_not_summing_to_one(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[
                    SlotInput(
                        entries=[
                            _entry("a", weight=0.5),
                            _entry("b", weight=0.4),
                        ]
                    )
                ],
                meals=[None, None, None],
            )
        )


def test_compute_team_production_rejects_zero_weight(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=[_entry("a", weight=0.0)])],
                meals=[None, None, None],
            )
        )


def test_compute_team_production_aggregates_members(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_team_production(
        TeamProductionInput(slots=_slots("a"), meals=[None, None, None])
    )
    assert result.member_count == 1
    assert result.total_strength > 0
    # No meals: the empty pot is still topped up with fillers.
    assert result.grand_total_strength == result.total_strength + result.kitchen.total


def test_compute_team_production_member_carries_full_production(
    production_service: DefaultProductionService,
) -> None:
    """Each MemberContributionDTO carries a full ProductionResult matching compute_production."""
    result = production_service.compute_team_production(
        TeamProductionInput(slots=_slots("a"), meals=[None, None, None])
    )
    assert result.member_count == 1
    member = result.members[0]
    # production field must exist and be a ProductionResult
    prod = member.production
    assert prod is not None
    # The full production must agree with compute_production for the same config.
    standalone = production_service.compute_production(_pokemon())
    assert prod.berry_amount == standalone.berry_amount
    assert prod.berry_strength == standalone.berry_strength
    assert prod.skill_triggers == standalone.skill_triggers
    assert prod.seconds_per_help == standalone.seconds_per_help
    assert prod.helps_per_day == standalone.helps_per_day
    assert prod.berry == standalone.berry
    assert prod.inventory == standalone.inventory
    assert prod.inventory_fill_hours == standalone.inventory_fill_hours
    assert prod.sleep_sessions == standalone.sleep_sessions


def test_compute_team_production_adds_cooking_to_grand_total(
    production_service: DefaultProductionService,
) -> None:
    recipe = production_service.list_recipes()[0]
    result = production_service.compute_team_production(
        TeamProductionInput(
            slots=_slots("a"),
            meals=[MealSelectionInput(recipe=recipe.name, level=1), None, None],
        )
    )
    assert result.kitchen.recipe_strength == recipe.base_strength  # nivel 1 = base
    assert result.grand_total_strength == result.total_strength + result.kitchen.total


def test_compute_team_production_rejects_too_many_members(
    production_service: DefaultProductionService,
) -> None:
    ids = [f"p{i}" for i in range(6)]
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(slots=_slots(*ids), meals=[None, None, None])
        )


def test_compute_team_production_rejects_unknown_recipe(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=_slots("a"), meals=[MealSelectionInput(recipe="No Existe", level=1)]
            )
        )


def test_compute_team_production_rejects_recipe_level_out_of_range(
    production_service: DefaultProductionService,
) -> None:
    recipe = production_service.list_recipes()[0]
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=_slots("a"),
                meals=[MealSelectionInput(recipe=recipe.name, level=0)],
            )
        )
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            TeamProductionInput(
                slots=_slots("a"),
                meals=[MealSelectionInput(recipe=recipe.name, level=MAX_RECIPE_LEVEL + 1)],
            )
        )


# ---------------------------------------------------------------------------
# favorite_berries + island_bonus (Task 4)
# ---------------------------------------------------------------------------


@pytest.fixture
def service_with_members(
    production_service: DefaultProductionService,
) -> tuple[DefaultProductionService, list[str]]:
    return production_service, ["a"]


def test_favorite_berries_and_bonus_flow(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    base = service.compute_team_production(
        TeamProductionInput(slots=_slots(*member_ids), meals=[])
    )
    boosted = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids),
            meals=[],
            favorite_berries=[],       # sin favoritas para aislar el efecto del bonus
            island_bonus=0.2,
        )
    )
    assert boosted.island_bonus == 0.2
    assert boosted.total_berry_strength_base == base.total_berry_strength
    assert boosted.total_berry_strength == pytest.approx(base.total_berry_strength * 1.2)
    assert boosted.grand_total_strength == pytest.approx(
        boosted.grand_total_strength_base * 1.2
    )


def test_bonus_out_of_range_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(slots=_slots(*member_ids), meals=[], island_bonus=0.9)
        )


def test_too_many_favorites_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                slots=_slots(*member_ids),
                meals=[],
                favorite_berries=["Oran", "Pecha", "Wiki", "Mago"],
            )
        )


def test_duplicate_favorites_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                slots=_slots(*member_ids),
                meals=[],
                favorite_berries=["Oran", "Oran"],
            )
        )


def test_unknown_berry_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                slots=_slots(*member_ids),
                meals=[],
                favorite_berries=["Banana"],
            )
        )


def test_unknown_berry_error_message_has_correct_gender_agreement(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    """Error message uses 'Valor inválido para' to ensure gender agreement works
    regardless of field label gender (feminine 'Baya', masculine labels, or English)."""
    service, member_ids = service_with_members
    with pytest.raises(ValidationError, match=r"Valor inválido para Baya: 'Banana'\."):
        service.compute_team_production(
            TeamProductionInput(
                slots=_slots(*member_ids),
                meals=[],
                favorite_berries=["Banana"],
            )
        )


# ---------------------------------------------------------------------------
# island / main_favorite / weekly_bonus (Task 6)
# ---------------------------------------------------------------------------


def test_an_expert_map_penalizes_a_member_without_a_favorite_berry(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    """With no favorites picked, an expert map penalizes the whole team."""
    service, member_ids = service_with_members
    normal = service.compute_team_production(
        TeamProductionInput(slots=_slots(*member_ids), meals=[])
    )
    expert = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids), meals=[], island="Cyan Beach (Expert)"
        ),
    )
    assert expert.total_strength < normal.total_strength


def test_the_main_favorite_speeds_up_the_member_that_gathers_it(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    sub_only = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids),
            meals=[],
            island="Cyan Beach (Expert)",
            favorite_berries=["Grepa"],
        ),
    )
    as_main = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids),
            meals=[],
            island="Cyan Beach (Expert)",
            favorite_berries=["Grepa"],
            main_favorite="Grepa",
        ),
    )
    assert as_main.total_strength > sub_only.total_strength


def test_cyan_beach_expert_penalizes_harder_than_greengrass_expert(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    """Each expert map has its own penalty: 35% slower on Cyan, 15% on Greengrass."""
    service, member_ids = service_with_members
    greengrass, cyan = (
        service.compute_team_production(
            TeamProductionInput(slots=_slots(*member_ids), meals=[], island=island)
        )
        for island in ("Greengrass Isle (Expert)", "Cyan Beach (Expert)")
    )
    assert cyan.total_strength < greengrass.total_strength


def test_the_client_cannot_ask_for_expert_effects_on_a_normal_map(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    """``expert`` is derived from the map, never received: a normal map ignores the bonus."""
    service, member_ids = service_with_members
    plain = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids),
            meals=[],
            island="Cyan Beach",
            favorite_berries=["Grepa"],
        ),
    )
    with_bonus = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids),
            meals=[],
            island="Cyan Beach",
            favorite_berries=["Grepa"],
            main_favorite="Grepa",
            weekly_bonus="skill_trigger",
        ),
    )
    assert plain.total_strength == with_bonus.total_strength


def test_the_main_favorite_must_be_one_of_the_favorites(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                slots=_slots(*member_ids),
                meals=[],
                island="Cyan Beach (Expert)",
                favorite_berries=["Oran"],
                main_favorite="Pecha",
            ),
        )


def test_an_unknown_map_is_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(slots=_slots(*member_ids), meals=[], island="Atlantis")
        )


def test_an_unknown_weekly_bonus_is_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                slots=_slots(*member_ids),
                meals=[],
                island="Cyan Beach (Expert)",
                weekly_bonus="free_candy",
            ),
        )


def test_a_weekly_bonus_without_an_expert_map_is_ignored_not_rejected(
    service_with_members: tuple[DefaultProductionService, list[str]],
) -> None:
    """Switching maps can leave a stale bonus behind: it's ignored, not an error."""
    service, member_ids = service_with_members
    result = service.compute_team_production(
        TeamProductionInput(
            slots=_slots(*member_ids),
            meals=[],
            island="Cyan Beach",
            weekly_bonus="ingredient",
        ),
    )
    assert result.total_strength > 0


def _pikachu(**extra: object) -> ProductionInput:
    """The same config, with whatever scenario each test needs."""
    return ProductionInput(
        species="Pikachu",
        level=60,
        ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
        **extra,  # type: ignore[arg-type]
    )


def test_compute_production_favorite_berry_doubles_strength(
    production_service: DefaultProductionService,
) -> None:
    plain = production_service.compute_production(_pikachu())
    favorite = production_service.compute_production(_pikachu(scenario="favorite"))
    assert favorite.berry_strength == pytest.approx(plain.berry_strength * 2)
    # A favorite berry only multiplies strength: not cadence, not the skill.
    assert favorite.seconds_per_help == plain.seconds_per_help
    assert favorite.skill_triggers == pytest.approx(plain.skill_triggers)


def test_compute_production_expert_berry_scenario(
    production_service: DefaultProductionService,
) -> None:
    plain = production_service.compute_production(_pikachu())
    expert = production_service.compute_production(_pikachu(scenario="expert_berry"))
    # rel: per-berry strength is rounded to an integer AFTER the multiplier.
    assert expert.berry_strength == pytest.approx(plain.berry_strength * 2.4, rel=0.01)


def test_compute_production_expert_ingredient_scenario(
    production_service: DefaultProductionService,
) -> None:
    favorite = production_service.compute_production(_pikachu(scenario="favorite"))
    expert = production_service.compute_production(_pikachu(scenario="expert_ingredient"))
    assert sum(s.amount for s in expert.ingredients) > sum(s.amount for s in favorite.ingredients)
    # More items per help also fills the inventory sooner.
    assert expert.inventory_fill_hours < favorite.inventory_fill_hours


def test_compute_production_expert_skill_scenario(
    production_service: DefaultProductionService,
) -> None:
    favorite = production_service.compute_production(_pikachu(scenario="favorite"))
    expert = production_service.compute_production(_pikachu(scenario="expert_skill"))
    assert expert.skill_triggers > favorite.skill_triggers
    assert expert.sleep_sessions[0].skill_chances[0] > favorite.sleep_sessions[0].skill_chances[0]


def test_compute_production_scenario_is_never_the_main_berry(
    production_service: DefaultProductionService,
) -> None:
    # Comparison reads every card as a SUB favorite: no x0.9 cadence, no Skill +1,
    # which belong to the main berry alone.
    plain = production_service.compute_production(_pikachu(skill_level=3))
    for scenario in ("expert_berry", "expert_ingredient", "expert_skill"):
        expert = production_service.compute_production(_pikachu(skill_level=3, scenario=scenario))
        assert expert.effective_skill_level == plain.effective_skill_level == 3
        assert expert.seconds_per_help == plain.seconds_per_help


def test_compute_production_rejects_unknown_scenario(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(_pikachu(scenario="double_xp"))


def _team(**overrides: object) -> TeamProductionInput:
    defaults: dict[str, object] = {"slots": _slots("a"), "meals": [None, None, None]}
    defaults.update(overrides)
    return TeamProductionInput(**defaults)  # type: ignore[arg-type]


def test_team_kitchen_uses_pot_size(production_service: DefaultProductionService) -> None:
    result = production_service.compute_team_production(_team(pot_size=33))
    assert result.kitchen.pot.base_daily == 99
    assert result.kitchen.pot.per_meal >= 33


def test_team_rejects_pot_size_off_the_ladder(
    production_service: DefaultProductionService,
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(_team(pot_size=22))


def test_team_ticket_enlarges_the_pot(production_service: DefaultProductionService) -> None:
    off = production_service.compute_team_production(_team(pot_size=21))
    on = production_service.compute_team_production(_team(pot_size=21, good_camp_ticket=True))
    assert on.kitchen.pot.per_meal > off.kitchen.pot.per_meal


def test_team_grand_total_includes_the_kitchen(
    production_service: DefaultProductionService,
) -> None:
    recipe = production_service.list_recipes()[0]
    result = production_service.compute_team_production(
        _team(meals=[MealSelectionInput(recipe=recipe.name, level=1), None, None])
    )
    assert result.kitchen.total > 0
    assert result.grand_total_strength == pytest.approx(
        result.total_strength + result.kitchen.total
    )
    # Fancy Apple Curry has 7 ingredients: fits pot (base 21).
    assert result.cooking_meals[0].fits_pot is True
    assert result.cooking_meals[0].strength_base == pytest.approx(result.cooking_meals[0].strength)


def test_team_kitchen_applies_island_bonus_to_cooking_meals(
    production_service: DefaultProductionService,
) -> None:
    recipe = production_service.list_recipes()[0]  # Fancy Apple Curry, 7 ingredients
    result = production_service.compute_team_production(
        _team(
            meals=[MealSelectionInput(recipe=recipe.name, level=1), None, None],
            island_bonus=0.5,
        )
    )
    # strength = strength_base * 1.5 when island_bonus = 0.5
    assert result.cooking_meals[0].strength == pytest.approx(
        result.cooking_meals[0].strength_base * 1.5
    )
    assert result.kitchen.total == pytest.approx(result.kitchen.total_base * 1.5)


def test_team_kitchen_fits_pot_flag_for_oversized_recipe(
    production_service: DefaultProductionService,
) -> None:
    # Soft Potato Chowder has 10+8+4=22 ingredients, exceeds pot base (21).
    recipe = next(r for r in production_service.list_recipes() if r.name == "Soft Potato Chowder")
    result = production_service.compute_team_production(
        _team(meals=[MealSelectionInput(recipe=recipe.name, level=1), None, None])
    )
    assert result.cooking_meals[0].fits_pot is False


def _fx(
    kind: str, value: float, scope: str = "team", target: str | None = None
) -> EventEffectInput:
    return EventEffectInput(kind=kind, value=value, scope=scope, target=target)


def test_team_without_effects_is_unchanged(production_service: DefaultProductionService) -> None:
    assert production_service.compute_team_production(
        _team(event_effects=[])
    ) == production_service.compute_team_production(_team())


def test_team_event_raises_production(production_service: DefaultProductionService) -> None:
    base = production_service.compute_team_production(_team())
    boosted = production_service.compute_team_production(
        _team(event_effects=[_fx("extra_berries", 1)])
    )
    assert boosted.total_berry_amount > base.total_berry_amount


def test_team_event_pot_multiplies_with_ticket(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_team_production(
        _team(pot_size=21, good_camp_ticket=True, event_effects=[_fx("pot_size", 2)])
    )
    skill_share = result.kitchen.pot.skill_daily / 3
    assert result.kitchen.pot.per_meal == math.ceil((21 + skill_share) * 1.5 * 2)


def test_team_event_dish_strength(production_service: DefaultProductionService) -> None:
    recipe = production_service.list_recipes()[0]
    meals = [MealSelectionInput(recipe=recipe.name, level=1), None, None]
    plain = production_service.compute_team_production(_team(meals=meals))
    boosted = production_service.compute_team_production(
        _team(meals=meals, event_effects=[_fx("dish_strength", 1.25)])
    )
    assert boosted.kitchen.total == pytest.approx(plain.kitchen.total * 1.25)
    assert boosted.cooking_meals[0].strength == pytest.approx(
        plain.cooking_meals[0].strength * 1.25
    )


def test_team_split_weights_bonused_production(
    production_service: DefaultProductionService,
) -> None:
    fx = [_fx("extra_berries", 1)]
    single = production_service.compute_team_production(_team(event_effects=fx))
    split = production_service.compute_team_production(
        _team(
            slots=[SlotInput(entries=[_entry("a", 0.6), _entry("b", 0.4)])],
            event_effects=fx,
        )
    )
    assert split.total_berry_amount == pytest.approx(single.total_berry_amount)


@pytest.mark.parametrize(
    "effect",
    [
        _fx("nope", 1),
        _fx("extra_ingredients", 6),
        _fx("extra_ingredients", 1.5),
        _fx("skill_trigger", 1.33),
        _fx("skill_trigger", 3.5),
        _fx("skill_trigger", float("inf")),
        _fx("skill_trigger", float("nan")),
        _fx("pot_size", 2, "type", "Fire"),
        _fx("skill_trigger", 1.5, "type", None),
        _fx("skill_trigger", 1.5, "type", "Plasma"),
        _fx("skill_trigger", 1.5, "specialty", "Cooking"),
        _fx("skill_trigger", 1.5, "galaxy", "Fire"),
    ],
)
def test_team_rejects_invalid_effects(
    production_service: DefaultProductionService, effect: EventEffectInput
) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(_team(event_effects=[effect]))


def test_team_rejects_too_many_effects(production_service: DefaultProductionService) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_team_production(
            _team(event_effects=[_fx("extra_berries", 1)] * 17)
        )


_SCEPTILE = {"species": "Sceptile", "ingredients": ["Fancy Egg", "Fancy Egg", "Fancy Egg"]}
_LATIOS = {"species": "Latios", "ingredients": ["Snoozy Tomato"] * 3}
_LATIAS = {"species": "Latias", "ingredients": ["Snoozy Tomato"] * 3}


def test_comparison_exposes_berry_burst_count_without_teammates(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_production(_pokemon(**_SCEPTILE, nature="", sub_skills=[]))
    assert result.skill_berry_amount == pytest.approx(result.skill_triggers * 11)
    assert result.skill_berries_per_teammate == pytest.approx(result.skill_triggers * 1)
    assert result.teammate_berries is None


def test_team_gives_the_burster_its_teammates_berries(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_team_production(
        TeamProductionInput(
            slots=[
                SlotInput(entries=[_entry("s", **_SCEPTILE)]),
                SlotInput(entries=[_entry("p")]),
            ],
            meals=[],
        )
    )
    sceptile = next(m for m in result.members if m.id == "s").production
    pikachu = next(m for m in result.members if m.id == "p").production
    assert sceptile.teammate_berries is not None
    assert [y.berry for y in sceptile.teammate_berries] == ["Grepa"]
    assert pikachu.teammate_berries is None
    grepa = next(r for r in result.berries if r.berry == "Grepa")
    assert [s.kind for s in grepa.sources] == ["helps", "skill"]
    assert grepa.sources[1].member_id == "s"


def test_team_draco_meteor_reads_latias_from_the_roster(
    production_service: DefaultProductionService,
) -> None:
    def latios_own(*others: dict[str, object]) -> float:
        slots = [SlotInput(entries=[_entry("l", **_LATIOS)])]
        slots += [SlotInput(entries=[_entry(f"o{i}", **o)]) for i, o in enumerate(others)]
        team = production_service.compute_team_production(
            TeamProductionInput(slots=slots, meals=[])
        )
        prod = next(m for m in team.members if m.id == "l").production
        assert prod.skill_berry_amount is not None
        return prod.skill_berry_amount / prod.skill_triggers

    assert latios_own() == pytest.approx(12)
    assert latios_own(_LATIAS) == pytest.approx(16)  # 2 Dragon species + Latias


def test_team_lunar_blessing_counts_species_sharing_its_berry(
    production_service: DefaultProductionService,
) -> None:
    cresselia = {"species": "Cresselia", "ingredients": ["Warming Ginger"] * 3, "skill_level": 6}
    ralts = {"species": "Ralts", "ingredients": ["Fancy Apple"] * 3}
    gardevoir = {"species": "Gardevoir", "ingredients": ["Fancy Apple"] * 3}

    def cresselia_per_trigger(*others: dict[str, object]) -> tuple[float, float]:
        slots = [SlotInput(entries=[_entry("c", **cresselia)])]
        slots += [SlotInput(entries=[_entry(f"o{i}", **o)]) for i, o in enumerate(others)]
        team = production_service.compute_team_production(
            TeamProductionInput(slots=slots, meals=[])
        )
        prod = next(m for m in team.members if m.id == "c").production
        assert prod.skill_berry_amount is not None
        assert prod.skill_berries_per_teammate is not None
        t = prod.skill_triggers
        return prod.skill_berry_amount / t, prod.skill_berries_per_teammate / t

    assert cresselia_per_trigger() == pytest.approx((25, 1))
    # Ralts and Gardevoir also have Mago: 3 species sharing the berry.
    assert cresselia_per_trigger(ralts, gardevoir, _SCEPTILE) == pytest.approx((30, 4))


def test_berry_burst_burster_weight_is_applied_exactly_once(
    production_service: DefaultProductionService,
) -> None:
    """Splitting the burster's slot 50/50 halves its teammate berries, not quarters them."""

    def team(slot0: list[SlotEntryInput]) -> TeamProductionResult:
        return production_service.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=slot0), SlotInput(entries=[_entry("p")])],
                meals=[None, None, None],
            )
        )

    def grepa_burst(result: TeamProductionResult, member_id: str) -> BerrySourceDTO:
        row = next(r for r in result.berries if r.berry == "Grepa")
        return next(
            s for s in row.sources if s.kind == "skill" and s.member_id == member_id
        )

    solo = team([_entry("s", 1.0, **_SCEPTILE)])
    split = team([_entry("s", 0.5, **_SCEPTILE), _entry("x", 0.5)])

    solo_s = next(m for m in solo.members if m.id == "s").production.teammate_berries
    split_s = next(m for m in split.members if m.id == "s").production.teammate_berries
    assert solo_s and split_s
    assert split_s[0].amount == pytest.approx(solo_s[0].amount * 0.5)
    assert split_s[0].strength == pytest.approx(solo_s[0].strength * 0.5)
    assert grepa_burst(split, "s").amount == pytest.approx(grepa_burst(solo, "s").amount * 0.5)


def test_team_extra_helpful_helps_turn_into_berries_and_ingredients(
    production_service: DefaultProductionService,
) -> None:
    arcanine = {"species": "Arcanine", "ingredients": ["Fiery Herb"] * 3}
    team = production_service.compute_team_production(
        TeamProductionInput(
            slots=[
                SlotInput(entries=[_entry("a", **arcanine)]),
                SlotInput(entries=[_entry("p")]),
            ],
            meals=[],
        )
    )
    prod = next(m for m in team.members if m.id == "a").production
    pikachu = next(m for m in team.members if m.id == "p").production
    # Pikachu's share of the helps lands as Grepa credited to Arcanine.
    assert prod.teammate_berries is not None
    assert [y.berry for y in prod.teammate_berries] == ["Grepa"]
    grepa = next(r for r in team.berries if r.berry == "Grepa")
    assert [(s.kind, s.member_id) for s in grepa.sources] == [("helps", None), ("skill", "a")]
    # Its own share adds Leppa from the skill to its own berries.
    assert prod.skill_berry_amount is not None and prod.skill_berry_amount > 0
    # Ingredients follow the berries: its own share joins its skill ingredients,
    # Pikachu's lands apart as teammate ingredients; the team counts both.
    assert [s.ingredient for s in prod.skill_ingredients] == ["Fiery Herb"]
    assert prod.teammate_ingredients is not None
    assert [s.ingredient for s in prod.teammate_ingredients] == ["Fancy Apple", "Warming Ginger"]
    assert pikachu.teammate_ingredients is None
    produced = sum(
        s.amount
        for p in (prod, pikachu)
        for s in (*p.ingredients, *p.skill_ingredients, *(p.teammate_ingredients or []))
    )
    assert team.total_ingredients == pytest.approx(produced)


def test_team_helper_boost_helps_every_member_more_with_same_berry_species(
    production_service: DefaultProductionService,
) -> None:
    raikou = {"species": "Raikou", "ingredients": ["Bean Sausage"] * 3, "skill_level": 6}

    def helps_per_trigger(*others: dict[str, object]) -> float:
        slots = [SlotInput(entries=[_entry("r", **raikou)])]
        slots += [SlotInput(entries=[_entry(f"o{i}", **o)]) for i, o in enumerate(others)]
        team = production_service.compute_team_production(
            TeamProductionInput(slots=slots, meals=[])
        )
        prod = next(m for m in team.members if m.id == "r").production
        assert prod.skill_extra_helpful is not None
        assert prod.skill_help_targets == 5
        return prod.skill_extra_helpful / prod.skill_triggers

    assert helps_per_trigger(_SCEPTILE) == pytest.approx(5)
    # Pikachu also has Grepa: 2 species sharing Raikou's berry → +1 at level 6.
    assert helps_per_trigger({"species": "Pikachu", "ingredients": ["Fancy Apple"] * 3}) == (
        pytest.approx(6)
    )


def test_team_heal_pulse_helps_two_members_more_with_latios(
    production_service: DefaultProductionService,
) -> None:
    latias = {"species": "Latias", "ingredients": ["Snoozy Tomato"] * 3, "skill_level": 6}

    def team_with(*others: dict[str, object]) -> tuple[float, int | None, int]:
        slots = [SlotInput(entries=[_entry("l", **latias)])]
        slots += [SlotInput(entries=[_entry(f"o{i}", **o)]) for i, o in enumerate(others)]
        team = production_service.compute_team_production(
            TeamProductionInput(slots=slots, meals=[])
        )
        prod = next(m for m in team.members if m.id == "l").production
        assert prod.skill_extra_helpful is not None
        assert prod.teammate_berries is not None
        return (
            prod.skill_extra_helpful / prod.skill_triggers,
            prod.skill_help_targets,
            len(prod.teammate_berries),
        )

    assert team_with(_SCEPTILE) == (pytest.approx(4), 2, 1)
    assert team_with(_SCEPTILE, _LATIOS) == (pytest.approx(7), 2, 2)


def test_no_sleep_means_the_default_night(production_service: DefaultProductionService) -> None:
    implicit = production_service.compute_production(_pokemon())
    explicit = production_service.compute_production(
        _pokemon(sleep=SleepInput(night_minutes=510))
    )
    assert implicit == explicit
    assert [s.kind for s in implicit.sleep_sessions] == ["night"]


def test_a_nap_adds_a_session(production_service: DefaultProductionService) -> None:
    result = production_service.compute_production(
        _pokemon(sleep=SleepInput(night_minutes=390, nap_minutes=120))
    )
    assert [(s.kind, s.hours) for s in result.sleep_sessions] == [
        ("night", 6.5),
        ("nap", 2.0),
    ]


def test_team_members_use_the_requested_sleep(
    production_service: DefaultProductionService,
) -> None:
    result = production_service.compute_team_production(
        TeamProductionInput(
            slots=_slots("a"),
            meals=[None, None, None],
            sleep=SleepInput(night_minutes=390, nap_minutes=120),
        )
    )
    assert len(result.members[0].production.sleep_sessions) == 2


def test_an_invalid_sleep_is_rejected(production_service: DefaultProductionService) -> None:
    with pytest.raises(ValidationError):
        production_service.compute_production(_pokemon(sleep=SleepInput(night_minutes=60)))
