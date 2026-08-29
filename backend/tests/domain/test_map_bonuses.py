import pytest

from sleepmon.domain.map_bonuses import (
    BerryEffects,
    MapBonuses,
    berry_effects,
)
from sleepmon.domain.value_objects import Berry, BerryRole, WeeklyBonus

MAIN = Berry.ORAN
SUB_A = Berry.PAMTRE
SUB_B = Berry.PECHA
OTHER = Berry.YACHE


def _expert(weekly: WeeklyBonus = WeeklyBonus.BERRY_STRENGTH) -> MapBonuses:
    return MapBonuses(
        main=MAIN, subs=frozenset({SUB_A, SUB_B}), expert=True, weekly_bonus=weekly
    )


def _normal() -> MapBonuses:
    return MapBonuses(main=MAIN, subs=frozenset({SUB_A, SUB_B}))


# ── favorites / role_of ────────────────────────────────────────────────────────

def test_favorites_includes_the_main_berry() -> None:
    assert _expert().favorites == {MAIN, SUB_A, SUB_B}


def test_favorites_without_a_main_is_just_the_subs() -> None:
    assert MapBonuses(subs=frozenset({SUB_A})).favorites == {SUB_A}


def test_role_on_an_expert_map() -> None:
    bonuses = _expert()
    assert bonuses.role_of(MAIN) is BerryRole.MAIN
    assert bonuses.role_of(SUB_A) is BerryRole.SUB
    assert bonuses.role_of(OTHER) is BerryRole.NONE


def test_a_normal_map_never_reports_a_main_berry() -> None:
    """Without expert mode the main berry is just another favorite: no effects of its own."""
    assert _normal().role_of(MAIN) is BerryRole.SUB


# ── invariants ───────────────────────────────────────────────────────────────

def test_the_main_berry_cannot_repeat_among_the_subs() -> None:
    with pytest.raises(ValueError):
        MapBonuses(main=MAIN, subs=frozenset({MAIN}))


def test_at_most_three_favorites() -> None:
    with pytest.raises(ValueError):
        MapBonuses(main=MAIN, subs=frozenset({SUB_A, SUB_B, OTHER}))


# ── berry_effects: normal map ──────────────────────────────────────────────────

def test_a_normal_map_only_doubles_the_favorite_berries() -> None:
    assert berry_effects(_normal(), MAIN) == BerryEffects(berry_multiplier=2.0)
    assert berry_effects(_normal(), SUB_A) == BerryEffects(berry_multiplier=2.0)


def test_a_normal_map_leaves_other_berries_untouched() -> None:
    assert berry_effects(_normal(), OTHER) == BerryEffects()


def test_no_map_at_all_is_neutral() -> None:
    assert berry_effects(MapBonuses(), OTHER) == BerryEffects()


# ── berry_effects: expert map ──────────────────────────────────────────────────

def test_the_main_berry_helps_faster_and_gains_a_skill_level() -> None:
    effects = berry_effects(_expert(), MAIN)
    assert effects.speed_factor == 0.9
    assert effects.skill_level_bonus == 1


def test_a_sub_favorite_gets_neither_the_speed_nor_the_skill_level() -> None:
    effects = berry_effects(_expert(), SUB_A)
    assert effects.speed_factor == 1.0
    assert effects.skill_level_bonus == 0


def test_a_berry_that_is_not_favorite_is_slowed_and_gets_no_bonus() -> None:
    assert berry_effects(_expert(), OTHER) == BerryEffects(speed_factor=1.15)


def test_with_no_favorites_chosen_every_berry_is_penalized() -> None:
    """PRD: the penalty applies as soon as the area is selected."""
    bare = MapBonuses(expert=True)
    assert berry_effects(bare, MAIN) == BerryEffects(speed_factor=1.15)


# ── berry_effects: the weekly bonus ────────────────────────────────────────────

def test_the_berry_strength_bonus_replaces_the_doubling() -> None:
    """x2.4, NOT x2 x 2.4."""
    assert berry_effects(_expert(), SUB_A).berry_multiplier == 2.4


def test_the_other_weekly_bonuses_keep_the_plain_doubling() -> None:
    for weekly in (WeeklyBonus.INGREDIENT, WeeklyBonus.SKILL_TRIGGER):
        assert berry_effects(_expert(weekly), SUB_A).berry_multiplier == 2.0


def test_the_ingredient_bonus_adds_one_per_find() -> None:
    effects = berry_effects(_expert(WeeklyBonus.INGREDIENT), SUB_A)
    assert effects.extra_ingredients == 1.0


def test_the_skill_bonus_raises_the_trigger_rate() -> None:
    effects = berry_effects(_expert(WeeklyBonus.SKILL_TRIGGER), SUB_A)
    assert effects.skill_rate_factor == 1.25


def test_the_weekly_bonus_never_reaches_a_non_favorite() -> None:
    for weekly in WeeklyBonus:
        effects = berry_effects(_expert(weekly), OTHER)
        assert effects.berry_multiplier == 1.0
        assert effects.extra_ingredients == 0.0
        assert effects.skill_rate_factor == 1.0


def test_the_main_berry_gets_the_weekly_bonus_too() -> None:
    assert berry_effects(_expert(WeeklyBonus.SKILL_TRIGGER), MAIN).skill_rate_factor == 1.25


def test_the_weekly_bonus_is_ignored_on_a_normal_map() -> None:
    bonuses = MapBonuses(
        main=MAIN, subs=frozenset({SUB_A}), weekly_bonus=WeeklyBonus.SKILL_TRIGGER
    )
    assert berry_effects(bonuses, MAIN) == BerryEffects(berry_multiplier=2.0)
