import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.leveling import MAX_LEVELABLE_LEVEL, level_up_cost
from sleepmon.domain.value_objects import CandyBoost, ExpNatureModifier, GrowthCurve


def test_minimal_span_normal_neutral_no_boost():
    cost = level_up_cost(1, 2)
    assert (cost.total_exp, cost.candies, cost.dream_shards) == (54, 2, 28)
    assert cost.boosted_candies == 0


def test_multi_level_span_carries_overflow():
    # Candy EXP overflow from level 1 carries into level 2.
    cost = level_up_cost(1, 3)
    assert (cost.total_exp, cost.candies, cost.dream_shards) == (125, 4, 64)


def test_full_candy_boost():
    cost = level_up_cost(1, 2, boost=CandyBoost.FULL)
    assert cost.candies == 1
    assert cost.dream_shards == 70
    assert cost.boosted_candies == 1


def test_mini_candy_boost_is_cheaper_than_full():
    cost = level_up_cost(1, 2, boost=CandyBoost.MINI)
    assert cost.candies == 1
    assert cost.dream_shards == 56


def test_nature_changes_candy_count():
    neutral = level_up_cost(10, 11)
    up = level_up_cost(10, 11, nature=ExpNatureModifier.UP)
    down = level_up_cost(10, 11, nature=ExpNatureModifier.DOWN)
    assert (neutral.total_exp, neutral.candies, neutral.dream_shards) == (345, 9, 450)
    assert up.candies == 8
    assert down.candies == 11


def test_pseudo_legendary_curve_scales_exp():
    cost = level_up_cost(1, 2, curve=GrowthCurve.PSEUDO_LEGENDARY)
    assert (cost.total_exp, cost.candies, cost.dream_shards) == (81, 3, 42)


def test_highest_span_to_cap():
    cost = level_up_cost(69, 70)
    assert (cost.total_exp, cost.candies, cost.dream_shards) == (3255, 131, 166632)


def test_mini_boost_caps_at_350_boosted_candies():
    cost = level_up_cost(1, 70, boost=CandyBoost.MINI)
    assert cost.candies > 350
    assert cost.boosted_candies == 350


def test_max_levelable_level_is_70():
    assert MAX_LEVELABLE_LEVEL == 70


@pytest.mark.parametrize(
    "current, target",
    [(1, 1), (5, 5), (5, 4), (0, 5), (1, 71)],
)
def test_invalid_ranges_raise(current, target):
    with pytest.raises(ValidationError):
        level_up_cost(current, target)
