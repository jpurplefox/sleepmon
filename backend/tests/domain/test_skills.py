from sleepmon.domain.catalog_data import MAX_SKILL_LEVEL
from sleepmon.domain.skills import (
    CHARGE_ENERGY_S_AMOUNTS,
    COOKING_POWER_UP_AMOUNTS,
    DREAM_SHARD_MAGNET_S_AMOUNTS,
    DREAM_SHARD_MAGNET_S_RANDOM_RANGES,
    ENERGIZING_CHEER_S_AMOUNTS,
    ENERGY_FOR_EVERYONE_AMOUNTS,
    EXTRA_HELPFUL_S_AMOUNTS,
    INGREDIENT_DRAW_AMOUNTS,
    INGREDIENT_MAGNET_AMOUNTS,
    TASTY_CHANCE_S_AMOUNTS,
    boosts_tasty_chance,
    charge_energy_amount,
    charge_strength_amount,
    charges_self_energy,
    cheers_random_energy,
    cooking_minus_energy_amount,
    cooking_minus_pot_amount,
    cooking_power_up_amount,
    draws_ingredients,
    dream_shard_amount,
    energizing_cheer_amount,
    energy_for_everyone_amount,
    extra_helpful_amount,
    ingredient_draw_amount,
    ingredient_draw_pool,
    ingredient_magnet_amount,
    is_cooking_minus,
    is_extra_helpful,
    is_magnet_plus,
    magnet_plus_base_amount,
    magnet_plus_bonus_amount,
    magnet_plus_bonus_ingredient,
    magnets_ingredients,
    powers_up_cooking,
    restores_team_energy,
    tasty_chance_amount,
)
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Berry, Ingredient, SleepType, Specialty

I = Ingredient  # noqa: E741


def _species(*, main_skill: str, ingredients: tuple[Ingredient, ...]) -> Species:
    amounts = tuple((1,) * (i + 1) for i in range(3))  # forma 1/2/3 acorde a los slots
    return Species(
        "Tester", 999, Specialty.SKILLS, Berry.LUM, SleepType.DOZING,
        main_skill, ingredients, 3200, 23.9, 6.4, amounts, 17, 1, 1,
    )


def test_draws_ingredients_recognizes_family_and_variants() -> None:
    pool = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)
    assert draws_ingredients(_species(main_skill="Ingredient Draw S", ingredients=pool))
    assert draws_ingredients(
        _species(main_skill="Ingredient Draw S (Super Luck)", ingredients=pool)
    )
    assert draws_ingredients(
        _species(main_skill="Ingredient Draw S (Hyper Cutter)", ingredients=pool)
    )


def test_draws_ingredients_false_for_other_skills() -> None:
    pool = (I.HONEY, I.SOFT_POTATO, I.FANCY_APPLE)
    assert not draws_ingredients(_species(main_skill="Ingredient Magnet S", ingredients=pool))
    assert not draws_ingredients(_species(main_skill="Charge Strength S", ingredients=pool))


def test_ingredient_draw_pool_dedupes_preserving_order() -> None:
    species = _species(
        main_skill="Ingredient Draw S",
        ingredients=(I.SOFT_POTATO, I.SOFT_POTATO, I.PURE_OIL),
    )
    assert ingredient_draw_pool(species) == (I.SOFT_POTATO, I.PURE_OIL)


def test_ingredient_draw_amount_matches_table() -> None:
    # nivel 1->5, 2->6, 3->8, 4->11, 5->13, 6->16, 7->18
    assert INGREDIENT_DRAW_AMOUNTS == (5, 6, 8, 11, 13, 16, 18)
    for level in range(1, MAX_SKILL_LEVEL + 1):
        assert ingredient_draw_amount(level) == INGREDIENT_DRAW_AMOUNTS[level - 1]


def test_ingredient_draw_amount_clamps_out_of_range() -> None:
    assert ingredient_draw_amount(0) == INGREDIENT_DRAW_AMOUNTS[0]
    assert ingredient_draw_amount(99) == INGREDIENT_DRAW_AMOUNTS[-1]


# --- Energy for Everyone S (E4E) ----------------------------------------------


def test_restores_team_energy_recognizes_family_and_variants() -> None:
    pool = (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE)
    assert restores_team_energy(_species(main_skill="Energy for Everyone S", ingredients=pool))
    assert restores_team_energy(
        _species(main_skill="Energy for Everyone S (Lunar Blessing)", ingredients=pool)
    )


def test_restores_team_energy_false_for_other_skills() -> None:
    pool = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)
    assert not restores_team_energy(_species(main_skill="Ingredient Draw S", ingredients=pool))


def test_energy_for_everyone_amount_matches_table_and_clamps() -> None:
    # niveles 1..6: 5, 7, 9, 11, 15, 18. E4E topa en 6.
    assert ENERGY_FOR_EVERYONE_AMOUNTS == (5, 7, 9, 11, 15, 18)
    for level in range(1, len(ENERGY_FOR_EVERYONE_AMOUNTS) + 1):
        assert energy_for_everyone_amount(level) == ENERGY_FOR_EVERYONE_AMOUNTS[level - 1]
    assert energy_for_everyone_amount(0) == 5
    assert energy_for_everyone_amount(7) == 18  # más allá del tope usa el nivel 6


# --- Ingredient Magnet S (ingredientes al azar, solo total) --------------------


def test_magnets_ingredients_recognizes_family_and_variants() -> None:
    pool = (I.HONEY, I.SOFT_POTATO, I.FANCY_APPLE)
    assert magnets_ingredients(_species(main_skill="Ingredient Magnet S", ingredients=pool))
    assert magnets_ingredients(
        _species(main_skill="Ingredient Magnet S (Plus)", ingredients=pool)
    )
    assert magnets_ingredients(
        _species(main_skill="Ingredient Magnet S (Present)", ingredients=pool)
    )


def test_magnets_ingredients_false_for_other_skills() -> None:
    pool = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)
    assert not magnets_ingredients(_species(main_skill="Ingredient Draw S", ingredients=pool))


def test_ingredient_magnet_amount_matches_table_and_clamps() -> None:
    # niveles 1..7: 6, 8, 11, 14, 17, 21, 24
    assert INGREDIENT_MAGNET_AMOUNTS == (6, 8, 11, 14, 17, 21, 24)
    for level in range(1, len(INGREDIENT_MAGNET_AMOUNTS) + 1):
        assert ingredient_magnet_amount(level) == INGREDIENT_MAGNET_AMOUNTS[level - 1]
    assert ingredient_magnet_amount(0) == 6
    assert ingredient_magnet_amount(99) == 24


# --- Cooking Power-Up S (ingredientes extra de pote) --------------------------


def test_powers_up_cooking_recognizes_family_and_variants() -> None:
    pool = (I.FIERY_HERB, I.BEAN_SAUSAGE, I.FANCY_EGG)
    assert powers_up_cooking(_species(main_skill="Cooking Power-Up S", ingredients=pool))
    assert powers_up_cooking(_species(main_skill="Cooking Power-Up S (Minus)", ingredients=pool))


def test_powers_up_cooking_false_for_other_skills() -> None:
    pool = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)
    assert not powers_up_cooking(_species(main_skill="Ingredient Draw S", ingredients=pool))


def test_cooking_power_up_amount_matches_table_and_clamps() -> None:
    # niveles 1..7: 7, 10, 12, 17, 22, 27, 31
    assert COOKING_POWER_UP_AMOUNTS == (7, 10, 12, 17, 22, 27, 31)
    for level in range(1, len(COOKING_POWER_UP_AMOUNTS) + 1):
        assert cooking_power_up_amount(level) == COOKING_POWER_UP_AMOUNTS[level - 1]
    assert cooking_power_up_amount(0) == 7
    assert cooking_power_up_amount(99) == 31


# --- Charge Strength S / M (fuerza; fija, rango y stockpile) -------------------


def test_charge_strength_fixed_s_and_m_match_tables() -> None:
    assert charge_strength_amount("Charge Strength S", 1) == 400
    assert charge_strength_amount("Charge Strength S", 7) == 3212
    assert charge_strength_amount("Charge Strength M", 1) == 880
    assert charge_strength_amount("Charge Strength M", 7) == 6858


def test_charge_strength_random_uses_midpoint() -> None:
    # nivel 1: 200..800 -> 500 ; nivel 7: 1606..6424 -> 4015
    assert charge_strength_amount("Charge Strength S (Random)", 1) == 500
    assert charge_strength_amount("Charge Strength S (Random)", 7) == 4015


def test_charge_strength_stockpile_and_other_skills_are_none() -> None:
    assert charge_strength_amount("Charge Strength S (Stockpile)", 7) is None
    assert charge_strength_amount("Ingredient Draw S", 7) is None


def test_charge_strength_amount_clamps_level() -> None:
    assert charge_strength_amount("Charge Strength S", 0) == 400
    assert charge_strength_amount("Charge Strength M", 99) == 6858


# --- Charge Energy S (energía al propio Pokémon) ------------------------------


def test_charges_self_energy_recognizes_family_and_variants() -> None:
    pool = (I.FANCY_APPLE, I.WARMING_GINGER, I.FANCY_EGG)
    assert charges_self_energy(_species(main_skill="Charge Energy S", ingredients=pool))
    assert charges_self_energy(_species(main_skill="Charge Energy S (Moonlight)", ingredients=pool))


def test_charges_self_energy_false_for_other_skills() -> None:
    pool = (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE)
    # E4E carga al equipo, no al usuario: no es Charge Energy.
    assert not charges_self_energy(_species(main_skill="Energy for Everyone S", ingredients=pool))


def test_charge_energy_amount_matches_table_and_clamps() -> None:
    # niveles 1..6: 12, 16, 21, 26, 33, 43. Topa en 6.
    assert CHARGE_ENERGY_S_AMOUNTS == (12, 16, 21, 26, 33, 43)
    for level in range(1, len(CHARGE_ENERGY_S_AMOUNTS) + 1):
        assert charge_energy_amount(level) == CHARGE_ENERGY_S_AMOUNTS[level - 1]
    assert charge_energy_amount(0) == 12
    assert charge_energy_amount(7) == 43  # más allá del tope usa el nivel 6


# --- Dream Shard Magnet S (fragmentos de sueño; fijo y rango, hasta nivel 8) ---


def test_dream_shard_fixed_matches_table() -> None:
    assert DREAM_SHARD_MAGNET_S_AMOUNTS == (240, 340, 480, 670, 920, 1260, 1800, 2500)
    for level in range(1, len(DREAM_SHARD_MAGNET_S_AMOUNTS) + 1):
        assert dream_shard_amount("Dream Shard Magnet S", level) == (
            DREAM_SHARD_MAGNET_S_AMOUNTS[level - 1]
        )


def test_dream_shard_random_uses_midpoint() -> None:
    # nivel 1: 120..480 -> 300 ; nivel 8: 1150..4600 -> 2875
    assert dream_shard_amount("Dream Shard Magnet S (Random)", 1) == 300
    assert dream_shard_amount("Dream Shard Magnet S (Random)", 8) == 2875
    lo, hi = DREAM_SHARD_MAGNET_S_RANDOM_RANGES[7]
    assert (lo, hi) == (1150, 4600)


def test_dream_shard_amount_clamps_to_level_8() -> None:
    assert dream_shard_amount("Dream Shard Magnet S", 0) == 240
    assert dream_shard_amount("Dream Shard Magnet S", 9) == 2500  # tope nivel 8


def test_dream_shard_amount_none_for_other_skills() -> None:
    assert dream_shard_amount("Ingredient Draw S", 8) is None


# --- Tasty Chance S (aumento de Extra Tasty, % por activación) -----------------


def test_boosts_tasty_chance_recognizes_skill() -> None:
    pool = (I.BEAN_SAUSAGE, I.FANCY_EGG, I.FANCY_APPLE)
    assert boosts_tasty_chance(_species(main_skill="Tasty Chance S", ingredients=pool))


def test_boosts_tasty_chance_false_for_other_skills() -> None:
    pool = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)
    assert not boosts_tasty_chance(_species(main_skill="Ingredient Draw S", ingredients=pool))


def test_tasty_chance_amount_matches_table_and_clamps() -> None:
    # niveles 1..6: 4, 5, 6, 7, 8, 10. Topa en 6.
    assert TASTY_CHANCE_S_AMOUNTS == (4, 5, 6, 7, 8, 10)
    for level in range(1, len(TASTY_CHANCE_S_AMOUNTS) + 1):
        assert tasty_chance_amount(level) == TASTY_CHANCE_S_AMOUNTS[level - 1]
    assert tasty_chance_amount(0) == 4
    assert tasty_chance_amount(8) == 10  # más allá del tope usa el nivel 6


# --- Extra Helpful S (multiplicador de ayuda) ---------------------------------


def test_is_extra_helpful_recognizes_skill() -> None:
    pool = (I.FANCY_APPLE, I.FANCY_EGG, I.BEAN_SAUSAGE)
    assert is_extra_helpful(_species(main_skill="Extra Helpful S", ingredients=pool))


def test_is_extra_helpful_false_for_other_skills() -> None:
    pool = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)
    assert not is_extra_helpful(_species(main_skill="Ingredient Draw S", ingredients=pool))


def test_extra_helpful_amount_matches_table_and_clamps() -> None:
    # niveles 1..7: 6, 7, 8, 9, 10, 11, 12
    assert EXTRA_HELPFUL_S_AMOUNTS == (6, 7, 8, 9, 10, 11, 12)
    for level in range(1, len(EXTRA_HELPFUL_S_AMOUNTS) + 1):
        assert extra_helpful_amount(level) == EXTRA_HELPFUL_S_AMOUNTS[level - 1]
    assert extra_helpful_amount(0) == 6
    assert extra_helpful_amount(99) == 12


# --- Energizing Cheer S (energía a un compañero al azar) ----------------------


def test_cheers_random_energy_recognizes_family_and_variants() -> None:
    pool = (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE)
    assert cheers_random_energy(_species(main_skill="Energizing Cheer S", ingredients=pool))
    assert cheers_random_energy(
        _species(main_skill="Energizing Cheer S (Heal Pulse)", ingredients=pool)
    )
    assert cheers_random_energy(
        _species(main_skill="Energizing Cheer S (Nuzzle)", ingredients=pool)
    )


def test_cheers_random_energy_false_for_other_energy_skills() -> None:
    pool = (I.MOOMOO_MILK, I.SOOTHING_CACAO, I.BEAN_SAUSAGE)
    # E4E (a cada uno) y Charge Energy (a sí mismo) NO son Energizing Cheer.
    assert not cheers_random_energy(_species(main_skill="Energy for Everyone S", ingredients=pool))
    assert not cheers_random_energy(_species(main_skill="Charge Energy S", ingredients=pool))


def test_energizing_cheer_amount_matches_table_and_clamps() -> None:
    # niveles 1..6: 14, 17, 22, 28, 38, 50. Topa en 6.
    assert ENERGIZING_CHEER_S_AMOUNTS == (14, 17, 22, 28, 38, 50)
    for level in range(1, len(ENERGIZING_CHEER_S_AMOUNTS) + 1):
        assert energizing_cheer_amount(level) == ENERGIZING_CHEER_S_AMOUNTS[level - 1]
    assert energizing_cheer_amount(0) == 14
    assert energizing_cheer_amount(7) == 50  # más allá del tope usa el nivel 6


# --- Sinergia Plus/Minun (Plusle y Minun) -------------------------------------


def test_magnet_plus_detected_with_own_base_and_bonus() -> None:
    pool = (I.ROUSING_COFFEE, I.LARGE_LEEK, I.MOOMOO_MILK)
    sp = _species(main_skill="Ingredient Magnet S (Plus)", ingredients=pool)
    assert is_magnet_plus(sp)
    # Base al azar nivel 7 = 18 (no la tabla regular, que daría 24).
    assert magnet_plus_base_amount(7) == 18
    assert magnet_plus_base_amount(7) != ingredient_magnet_amount(7)
    # Bonus (ingrediente fijo) nivel 7 = 12 ; nivel 1 = 6.
    assert magnet_plus_bonus_amount(7) == 12
    assert magnet_plus_bonus_amount(1) == 6


def test_magnet_plus_bonus_ingredient_is_species_specific() -> None:
    pool = (I.ROUSING_COFFEE, I.LARGE_LEEK, I.MOOMOO_MILK)
    plusle = Species(
        "Plusle", 311, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Ingredient Magnet S (Plus)", pool, 3200, 23.9, 6.4,
        ((1,), (2, 1), (4, 2, 3)), 17, 0, 0,
    )
    toxtricity = Species(
        "Toxtricity (Amped)", 849, Specialty.SKILLS, Berry.CHESTO, SleepType.DOZING,
        "Ingredient Magnet S (Plus)", pool, 3200, 23.9, 6.4,
        ((1,), (2, 1), (4, 2, 3)), 17, 0, 0,
    )
    assert magnet_plus_bonus_ingredient(plusle) == I.ROUSING_COFFEE  # café
    assert magnet_plus_bonus_ingredient(toxtricity) == I.MOOMOO_MILK  # leche
    # Una especie desconocida con la skill (caso teórico) no rompe: None.
    other = _species(main_skill="Ingredient Magnet S (Plus)", ingredients=pool)
    assert magnet_plus_bonus_ingredient(other) is None


def test_magnet_plus_is_distinct_from_regular_magnet() -> None:
    # (Present) y la base SÍ son magnet regular; (Plus) se trata aparte.
    pool = (I.HONEY, I.SOFT_POTATO, I.FANCY_APPLE)
    assert not is_magnet_plus(_species(main_skill="Ingredient Magnet S", ingredients=pool))
    present = _species(main_skill="Ingredient Magnet S (Present)", ingredients=pool)
    assert not is_magnet_plus(present)


def test_cooking_minus_detected_with_own_pot_and_energy_tables() -> None:
    pool = (I.HONEY, I.FANCY_EGG, I.MOOMOO_MILK)
    sp = _species(main_skill="Cooking Power-Up S (Minus)", ingredients=pool)
    assert is_cooking_minus(sp)
    # pote nivel 7 = 24 (tabla propia, distinta de la regular que da 31)
    assert cooking_minus_pot_amount(7) == 24
    assert cooking_minus_pot_amount(7) != cooking_power_up_amount(7)
    # bonus de energía nivel 7 = 35 ; nivel 1 = 8
    assert cooking_minus_energy_amount(7) == 35
    assert cooking_minus_energy_amount(1) == 8
