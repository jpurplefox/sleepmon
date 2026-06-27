import pytest

from sleepmon.domain.catalog_data import (
    INGREDIENT_UNLOCK_LEVELS,
    NATURE_EFFECTS,
    SUB_SKILL_TIERS,
    SUB_SKILL_UNLOCK_LEVELS,
    max_ingredient_slots,
    max_sub_skill_slots,
    ribbon_inventory_bonus,
    ribbon_speed_bonus,
)
from sleepmon.domain.species import SEED_SPECIES, Species
from sleepmon.domain.value_objects import (
    Berry,
    Ingredient,
    Nature,
    Ribbon,
    SleepType,
    Specialty,
    SubSkill,
    SubSkillTier,
)


def _by_name(name: str) -> Species:
    return next(sp for sp in SEED_SPECIES if sp.name == name)


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


def test_every_species_has_a_positive_dex() -> None:
    # El dex puede repetirse entre formas/variantes (Alolan Vulpix, Pikachu de evento,
    # Toxtricity Amped/Low Key, tamaños de Pumpkaboo/Gourgeist… comparten el dex
    # nacional con su base, que es justo para qué sirve el dex: el sprite).
    assert all(sp.dex > 0 for sp in SEED_SPECIES)


def test_species_names_are_unique() -> None:
    # El nombre (case-insensitive) es la clave real del catálogo: debe ser único
    # aunque varias formas compartan dex.
    names = [sp.name.casefold() for sp in SEED_SPECIES]
    assert len(set(names)) == len(names)


def test_catalog_covers_the_full_helper_roster() -> None:
    # Dataset completo del juego (nitoyon cruzado con nerolis-lab), salvo Mew/Darkrai
    # (especialistas "All" con cantidades de ingrediente no publicadas).
    assert len(SEED_SPECIES) == 230
    assert {sp.specialty for sp in SEED_SPECIES} == {
        Specialty.BERRIES,
        Specialty.INGREDIENTS,
        Specialty.SKILLS,
    }
    assert {sp.sleep_type for sp in SEED_SPECIES} == set(SleepType)


def test_known_species_have_the_correct_real_data() -> None:
    # Datos reales cruzados (nitoyon + nerolis-lab): regresión sobre correcciones a la
    # seed v1 vieja (Charmander era ingredient specialist, no berry; Bulbasaur es Dozing).
    charmander = _by_name("Charmander")
    assert charmander.specialty is Specialty.INGREDIENTS
    assert charmander.main_skill == "Ingredient Magnet S"
    assert charmander.berry is Berry.LEPPA
    assert _by_name("Bulbasaur").sleep_type is SleepType.DOZING


def test_berry_matches_the_type_to_berry_mapping_via_known_anchors() -> None:
    # La baya sale del tipo del Pokémon (bijección fija del juego), validada contra
    # nerolis-lab. Anclas representativas por tipo.
    anchors = {
        "Charizard": Berry.LEPPA,  # fire
        "Squirtle": Berry.ORAN,  # water
        "Pikachu": Berry.GREPA,  # electric
        "Venusaur": Berry.DURIN,  # grass
        "Glaceon": Berry.RAWST,  # ice
        "Mankey": Berry.CHERI,  # fighting
        "Ekans": Berry.CHESTO,  # poison
        "Dragonite": Berry.YACHE,  # dragon
        "Umbreon": Berry.WIKI,  # dark
        "Magnemite": Berry.BELUE,  # steel
        "Clefairy": Berry.PECHA,  # fairy
    }
    for name, berry in anchors.items():
        assert _by_name(name).berry is berry, name


def test_pity_helps_fixed_for_non_skill_specialists() -> None:
    # Ingrediente/baya: umbral fijo de 78 ayudas, sin importar la frecuencia.
    bulbasaur = _by_name("Bulbasaur")  # ingredientes
    assert bulbasaur.specialty is not Specialty.SKILLS
    assert bulbasaur.pity_helps == 78


def test_pity_helps_scales_with_base_frequency_for_skill_specialists() -> None:
    # Especialistas en skill: 140000 / frecuencia base (los rápidos toleran más).
    raikou = _by_name("Raikou")  # rápido (2100s)
    bonsly = _by_name("Bonsly")  # lentísimo (6300s)
    assert raikou.specialty is Specialty.SKILLS
    assert raikou.pity_helps == round(140_000 / raikou.help_frequency_seconds) == 67
    assert bonsly.pity_helps == round(140_000 / bonsly.help_frequency_seconds) == 22
    assert raikou.pity_helps > bonsly.pity_helps


def test_evolution_stage_matches_known_lines() -> None:
    # Etapa de evolución (nitoyon evolutionCount): 0 base, 1 primera, 2 segunda.
    assert _by_name("Bulbasaur").evolution_stage == 0
    assert _by_name("Ivysaur").evolution_stage == 1
    assert _by_name("Venusaur").evolution_stage == 2
    # Las formas que no evolucionan quedan en 0.
    assert _by_name("Ditto").evolution_stage == 0
    assert _by_name("Farfetch'd").evolution_stage == 0


def test_evolutions_remaining_is_line_minus_stage() -> None:
    # Lo que define el bonus de velocidad del listón: cuántas evoluciones le quedan.
    assert _by_name("Bulbasaur").evolutions_remaining == 2  # puede evolucionar 2 veces
    assert _by_name("Ivysaur").evolutions_remaining == 1  # puede 1 vez
    assert _by_name("Venusaur").evolutions_remaining == 0  # forma final: ninguna
    assert _by_name("Ditto").evolutions_remaining == 0  # no evoluciona


def test_carry_limit_adds_evolution_bonus_to_base_inventory() -> None:
    # base_inventory queda intacto; carry_limit le suma +5 por evolución.
    bulbasaur, ivysaur, venusaur = map(_by_name, ("Bulbasaur", "Ivysaur", "Venusaur"))
    bases = (bulbasaur.base_inventory, ivysaur.base_inventory, venusaur.base_inventory)
    assert bases == (11, 14, 17)  # base_inventory sin tocar
    assert bulbasaur.carry_limit == 11  # sin evolucionar: sin bonus
    assert ivysaur.carry_limit == 19  # 14 + 5
    assert venusaur.carry_limit == 27  # 17 + 10


def test_evolution_stage_defaults_to_zero_and_rejects_out_of_range() -> None:
    base = Species(
        "Solo", 1, Specialty.BERRIES, Berry.ORAN, SleepType.DOZING, "Skill",
        (Ingredient.HONEY,), 3600, 20.0, 5.0, ((1,), (1,), (1,)), 10,
    )
    assert base.evolution_stage == 0
    assert base.carry_limit == 10
    with pytest.raises(ValueError, match="evolution_stage"):
        Species(
            "Bad", 1, Specialty.BERRIES, Berry.ORAN, SleepType.DOZING, "Skill",
            (Ingredient.HONEY,), 3600, 20.0, 5.0, ((1,), (1,), (1,)), 10,
            evolution_stage=3,
        )


def test_line_evolutions_out_of_range_rejected() -> None:
    # line_evolutions debe estar entre evolution_stage y MAX_EVOLUTION_STAGE (2).
    with pytest.raises(ValueError, match="line_evolutions"):
        Species(
            "Bad", 1, Specialty.BERRIES, Berry.ORAN, SleepType.DOZING, "Skill",
            (Ingredient.HONEY,), 3600, 20.0, 5.0, ((1,), (1,), (1,)), 10,
            line_evolutions=3,  # > MAX_EVOLUTION_STAGE
        )
    with pytest.raises(ValueError, match="line_evolutions"):
        Species(
            "Bad", 1, Specialty.BERRIES, Berry.ORAN, SleepType.DOZING, "Skill",
            (Ingredient.HONEY,), 3600, 20.0, 5.0, ((1,), (1,), (1,)), 10,
            evolution_stage=2, line_evolutions=1,  # línea más corta que la etapa actual
        )


def test_ingredient_amounts_wrong_slot_count_rejected() -> None:
    # ingredient_amounts debe tener exactamente MAX_INGREDIENTS (3) slots.
    with pytest.raises(ValueError, match="ingredient_amounts"):
        Species(
            "Bad", 1, Specialty.BERRIES, Berry.ORAN, SleepType.DOZING, "Skill",
            (Ingredient.HONEY,), 3600, 20.0, 5.0, ((1,), (1,)), 10,  # solo 2 slots
        )


def test_ingredient_amounts_slot_width_mismatch_rejected() -> None:
    # Cada slot debe tener tantas cantidades como opciones (la forma de
    # ingredient_amounts debe coincidir con ingredient_slots, de anchos 1/2/3).
    with pytest.raises(ValueError, match="opciones"):
        Species(
            "Bad", 1, Specialty.INGREDIENTS, Berry.ORAN, SleepType.DOZING, "Skill",
            (Ingredient.HONEY, Ingredient.SNOOZY_TOMATO, Ingredient.SOFT_POTATO),
            3600, 20.0, 5.0, ((2,), (5,), (7, 7, 6)), 10,  # slot 1: 2 opciones, 1 cantidad
        )


def test_ribbon_inventory_bonus_is_cumulative() -> None:
    # Acumulativo: +1, +2, +3, +2 -> totales 1, 3, 6, 8.
    assert ribbon_inventory_bonus(Ribbon.NONE) == 0
    assert ribbon_inventory_bonus(Ribbon.SLEEP_200) == 1
    assert ribbon_inventory_bonus(Ribbon.SLEEP_500) == 3
    assert ribbon_inventory_bonus(Ribbon.SLEEP_1000) == 6
    assert ribbon_inventory_bonus(Ribbon.SLEEP_2000) == 8


def test_ribbon_speed_bonus_is_cumulative_and_scales_with_remaining_evolutions() -> None:
    # El 2º argumento son las evoluciones que le QUEDAN al Pokémon. Solo 500h/2000h
    # aportan velocidad, pero se acumulan: a las 1000h sigue el aporte de 500h, y a
    # las 2000h se suman ambos. Una forma final (0 pendientes) no recibe nada.
    assert ribbon_speed_bonus(Ribbon.SLEEP_200, 2) == 0.0
    assert ribbon_speed_bonus(Ribbon.SLEEP_500, 0) == 0.0  # totalmente evolucionado
    assert ribbon_speed_bonus(Ribbon.SLEEP_500, 1) == pytest.approx(0.05)
    assert ribbon_speed_bonus(Ribbon.SLEEP_500, 2) == pytest.approx(0.11)
    assert ribbon_speed_bonus(Ribbon.SLEEP_1000, 2) == pytest.approx(0.11)  # arrastra 500h
    assert ribbon_speed_bonus(Ribbon.SLEEP_2000, 1) == pytest.approx(0.12)  # 0.05 + 0.07
    assert ribbon_speed_bonus(Ribbon.SLEEP_2000, 2) == pytest.approx(0.25)  # 0.11 + 0.14


def test_max_ingredient_slots_scales_with_level() -> None:
    assert INGREDIENT_UNLOCK_LEVELS == (1, 30, 60)
    assert max_ingredient_slots(1) == 1
    assert max_ingredient_slots(29) == 1
    assert max_ingredient_slots(30) == 2
    assert max_ingredient_slots(60) == 3
