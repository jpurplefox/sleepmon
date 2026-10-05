import pytest

from sleepmon.domain.event_bonus import (
    NO_EVENT,
    EventBonus,
    EventEffect,
    EventScope,
    MemberBoosts,
)
from sleepmon.domain.event_bonus import (
    EventEffectKind as K,
)
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Berry, Ingredient, SleepType, Specialty, Type


def _species(specialty: Specialty = Specialty.INGREDIENTS, berry: Berry = Berry.ORAN) -> Species:
    # ORAN -> Water; MAGO -> Psychic
    return Species(
        "Tester", 999, specialty, berry, SleepType.DOZING, "Test Skill",
        (Ingredient.HONEY, Ingredient.HONEY, Ingredient.HONEY),
        3600, 20, 5, ((2,), (5, 6), (7, 8, 9)), 100, 0, 2,
    )


def test_no_event_is_neutral() -> None:
    assert NO_EVENT.boosts_for(_species()) == MemberBoosts()
    assert NO_EVENT.dish_strength_factor == 1.0
    assert NO_EVENT.pot_factor == 1.0


def test_scope_by_specialty_and_type() -> None:
    ing = EventScope(specialty=Specialty.INGREDIENTS)
    assert ing.reaches(_species(Specialty.INGREDIENTS))
    assert not ing.reaches(_species(Specialty.BERRIES))
    assert EventScope(type=Type.PSYCHIC).reaches(_species(berry=Berry.MAGO))
    assert not EventScope(type=Type.PSYCHIC).reaches(_species(berry=Berry.ORAN))
    assert EventScope().reaches(_species())


def test_all_specialty_is_in_scope_of_any_specialty() -> None:
    assert EventScope(specialty=Specialty.SKILLS).reaches(_species(Specialty.ALL))


def test_additive_effects_add_and_factors_multiply() -> None:
    event = EventBonus((
        EventEffect(K.EXTRA_INGREDIENTS, 1, EventScope(specialty=Specialty.INGREDIENTS)),
        EventEffect(K.EXTRA_INGREDIENTS, 1, EventScope(type=Type.PSYCHIC)),
        EventEffect(K.SKILL_TRIGGER, 1.5),
        EventEffect(K.SKILL_TRIGGER, 1.2),
    ))
    boosts = event.boosts_for(_species(Specialty.INGREDIENTS, Berry.MAGO))
    assert boosts.extra_ingredients == 2
    assert boosts.skill_rate_factor == pytest.approx(1.8)
    assert event.boosts_for(_species(Specialty.BERRIES, Berry.ORAN)).extra_ingredients == 0


def test_each_member_kind_maps_to_its_boost() -> None:
    event = EventBonus((
        EventEffect(K.EXTRA_BERRIES, 2),
        EventEffect(K.SKILL_INGREDIENTS, 1.5),
        EventEffect(K.SKILL_LEVEL, 3),
        EventEffect(K.CARRY_LIMIT, 10),
    ))
    assert event.boosts_for(_species()) == MemberBoosts(
        extra_berries=2, skill_ingredient_factor=1.5, skill_level_bonus=3, carry_limit_bonus=10
    )


def test_team_wide_factors() -> None:
    event = EventBonus((EventEffect(K.DISH_STRENGTH, 1.25), EventEffect(K.POT_SIZE, 2)))
    assert event.dish_strength_factor == 1.25
    assert event.pot_factor == 2
    assert event.boosts_for(_species()) == MemberBoosts()


@pytest.mark.parametrize(
    "effect_args",
    [
        (K.EXTRA_INGREDIENTS, 6),        # above 5
        (K.EXTRA_INGREDIENTS, 1.5),      # not whole
        (K.CARRY_LIMIT, 51),
        (K.SKILL_TRIGGER, 1.0),          # below 1.05
        (K.SKILL_TRIGGER, 3.5),
        (K.SKILL_TRIGGER, 1.33),         # off the 0.05 step
    ],
)
def test_out_of_range_values_are_rejected(effect_args: tuple[K, float]) -> None:
    with pytest.raises(ValueError):
        EventEffect(*effect_args)


def test_team_wide_kind_rejects_a_scope() -> None:
    with pytest.raises(ValueError):
        EventEffect(K.POT_SIZE, 2, EventScope(type=Type.FIRE))


def test_scope_cannot_set_both() -> None:
    with pytest.raises(ValueError):
        EventScope(type=Type.FIRE, specialty=Specialty.BERRIES)
