from sleepmon.domain.catalog_data import (
    INGREDIENT_UNLOCK_LEVELS,
    NATURE_EFFECTS,
    SUB_SKILL_TIERS,
    SUB_SKILL_UNLOCK_LEVELS,
    max_ingredient_slots,
    max_sub_skill_slots,
)
from sleepmon.domain.species import SEED_SPECIES
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill


def test_closed_sets_have_expected_sizes() -> None:
    assert len(Nature) == 25
    assert len(SubSkill) == 17
    assert len(Ingredient) == 19


def test_every_nature_has_an_effect() -> None:
    assert set(NATURE_EFFECTS) == set(Nature)


def test_exactly_five_neutral_natures() -> None:
    neutral = [n for n, eff in NATURE_EFFECTS.items() if eff.is_neutral]
    assert len(neutral) == 5


def test_non_neutral_natures_change_two_distinct_stats() -> None:
    for nature, eff in NATURE_EFFECTS.items():
        if eff.is_neutral:
            continue
        assert eff.increased is not None and eff.decreased is not None
        assert eff.increased != eff.decreased, nature


def test_every_sub_skill_has_a_tier() -> None:
    assert set(SUB_SKILL_TIERS) == set(SubSkill)


def test_sub_skill_unlock_levels_updated_to_new_patch() -> None:
    assert SUB_SKILL_UNLOCK_LEVELS == (10, 25, 50, 70, 80)


def test_max_sub_skill_slots_scales_with_level() -> None:
    assert max_sub_skill_slots(1) == 0
    assert max_sub_skill_slots(10) == 1
    assert max_sub_skill_slots(69) == 3
    assert max_sub_skill_slots(80) == 5
    assert max_sub_skill_slots(100) == 5


def test_every_species_has_three_non_empty_ingredient_slots() -> None:
    for sp in SEED_SPECIES:
        assert len(sp.ingredient_slots) == 3, sp.name
        for slot, options in enumerate(sp.ingredient_slots):
            assert options, f"{sp.name} slot {slot} vacío"


def test_species_primary_ingredient_is_single_and_present_downstream() -> None:
    # El slot 1 (nivel 1) es un único ingrediente fijo, y debe seguir siendo
    # válido en los slots posteriores.
    for sp in SEED_SPECIES:
        assert len(sp.ingredient_slots[0]) == 1, sp.name
        primary = next(iter(sp.ingredient_slots[0]))
        assert primary in sp.ingredient_slots[1], sp.name
        assert primary in sp.ingredient_slots[2], sp.name


def test_max_ingredient_slots_scales_with_level() -> None:
    assert INGREDIENT_UNLOCK_LEVELS == (1, 30, 60)
    assert max_ingredient_slots(1) == 1
    assert max_ingredient_slots(29) == 1
    assert max_ingredient_slots(30) == 2
    assert max_ingredient_slots(60) == 3
