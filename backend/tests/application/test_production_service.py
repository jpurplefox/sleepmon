import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.dto import (
    MealSelectionInput,
    ProductionInput,
    SlotEntryInput,
    SlotInput,
    TeamProductionInput,
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
                species="Mewtwo",
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
    assert result.grand_total_strength == result.total_strength  # sin cocina


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
    assert prod.night_skill_chances == standalone.night_skill_chances


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
    assert result.cooking_strength == recipe.base_strength  # nivel 1 = base
    assert result.grand_total_strength == result.total_strength + result.cooking_strength


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
    assert expert.night_skill_chances[0] > favorite.night_skill_chances[0]


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
