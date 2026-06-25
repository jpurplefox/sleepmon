from sleepmon.domain.catalog_data import (
    INGREDIENT_UNLOCK_LEVELS,
    NATURE_EFFECTS,
    SUB_SKILL_TIERS,
    SUB_SKILL_UNLOCK_LEVELS,
    max_ingredient_slots,
    max_sub_skill_slots,
)
from sleepmon.domain.species import SEED_SPECIES
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill, SubSkillTier


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


def test_inventory_up_m_and_l_are_blue() -> None:
    # Inventory Up M y L son blue (no gold), como en el juego.
    assert SUB_SKILL_TIERS[SubSkill.INVENTORY_UP_M] is SubSkillTier.BLUE
    assert SUB_SKILL_TIERS[SubSkill.INVENTORY_UP_L] is SubSkillTier.BLUE


def test_sub_skill_unlock_levels_updated_to_new_patch() -> None:
    assert SUB_SKILL_UNLOCK_LEVELS == (10, 25, 50, 70, 80)


def test_max_sub_skill_slots_scales_with_level() -> None:
    assert max_sub_skill_slots(1) == 0
    assert max_sub_skill_slots(10) == 1
    assert max_sub_skill_slots(69) == 3
    # Borde del 4º slot: se desbloquea en el nivel 70 y rige hasta el 79.
    assert max_sub_skill_slots(70) == 4
    assert max_sub_skill_slots(79) == 4
    assert max_sub_skill_slots(80) == 5
    assert max_sub_skill_slots(100) == 5


def test_every_species_has_three_non_empty_ingredient_slots() -> None:
    for sp in SEED_SPECIES:
        assert len(sp.ingredient_slots) == 3, sp.name
        for slot, options in enumerate(sp.ingredient_slots):
            assert options, f"{sp.name} slot {slot} vacío"


def test_allows_ingredient_rejects_out_of_range_slot() -> None:
    species = SEED_SPECIES[0]
    primary = next(iter(species.ingredient_slots[0]))
    assert species.allows_ingredient(0, primary) is True
    assert species.allows_ingredient(-1, primary) is False
    assert species.allows_ingredient(99, primary) is False


def test_allows_ingredient_rejects_ingredient_absent_from_a_valid_slot() -> None:
    # Slot en rango pero el ingrediente no pertenece a ese slot: la otra rama False.
    species = SEED_SPECIES[0]
    primary = next(iter(species.ingredient_slots[0]))  # único ingrediente del slot 0
    absent = next(i for i in Ingredient if i != primary)
    assert species.allows_ingredient(0, absent) is False


def test_species_primary_ingredient_is_single_and_present_downstream() -> None:
    # El slot 1 (nivel 1) es un único ingrediente fijo, y debe seguir siendo
    # válido en los slots posteriores.
    for sp in SEED_SPECIES:
        assert len(sp.ingredient_slots[0]) == 1, sp.name
        primary = next(iter(sp.ingredient_slots[0]))
        assert primary in sp.ingredient_slots[1], sp.name
        assert primary in sp.ingredient_slots[2], sp.name


def test_species_ingredient_slots_grow_monotonically() -> None:
    # Lo desbloqueado en el slot 2 (nivel 30) sigue disponible en el slot 3 (nivel 60).
    for sp in SEED_SPECIES:
        assert set(sp.ingredient_slots[1]) <= set(sp.ingredient_slots[2]), sp.name


def test_ingredient_slots_are_ordered_prefixes_of_the_ingredient_list() -> None:
    # Cada slot expone exactamente un prefijo de los ingredientes de la especie,
    # en el orden del juego (1º, 2º, 3º). Esto fija el orden de display y deja al
    # 1º siempre primero.
    for sp in SEED_SPECIES:
        for slot, options in enumerate(sp.ingredient_slots):
            assert options == sp.ingredients[: slot + 1], sp.name


def test_lv30_slot_never_offers_the_third_ingredient() -> None:
    # Regresión: el slot de nivel 30 solo puede ser el 1º o el 2º ingrediente,
    # nunca el 3º (p. ej. Caterpie: miel o tomate, jamás los beans).
    for sp in SEED_SPECIES:
        if len(sp.ingredients) < 3:
            continue
        third = sp.ingredients[2]
        assert third not in sp.ingredient_slots[1], sp.name


def test_short_species_still_reports_three_ingredient_slots() -> None:
    # Mareep tiene solo 2 ingredientes, pero ingredient_slots siempre devuelve 3
    # slots (el último repite el prefijo completo). slot_count derivado = 3.
    mareep = next(sp for sp in SEED_SPECIES if sp.name == "Mareep")
    assert len(mareep.ingredients) == 2
    assert len(mareep.ingredient_slots) == 3
    assert mareep.ingredient_slots[2] == mareep.ingredients  # el último slot no agrega nada


def test_every_species_has_a_unique_positive_dex() -> None:
    dexes = [sp.dex for sp in SEED_SPECIES]
    assert all(d > 0 for d in dexes), dexes
    assert len(set(dexes)) == len(dexes)  # sin repetidos


def test_max_ingredient_slots_scales_with_level() -> None:
    assert INGREDIENT_UNLOCK_LEVELS == (1, 30, 60)
    assert max_ingredient_slots(1) == 1
    assert max_ingredient_slots(29) == 1
    assert max_ingredient_slots(30) == 2
    assert max_ingredient_slots(60) == 3
