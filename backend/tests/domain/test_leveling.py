import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.leveling import LevelUpCost, level_up_cost
from sleepmon.domain.value_objects import GrowthCurve


def test_normal_one_level_counts_candies_and_shards() -> None:
    # Level 1 -> 2 needs 54 EXP; a candy gives 40 EXP (band 1-24); shards=14 at lvl 1.
    result = level_up_cost(1, 2)
    assert isinstance(result, LevelUpCost)
    assert result.current_level == 1
    assert result.target_level == 2
    assert result.total_exp == 54
    assert result.candies == 2          # 40, 80 -> 2 candies
    assert result.dream_shards == 28    # 2 * 14
    assert result.boosted_candies == 0


def test_legendary_multiplier_raises_exp_and_candies() -> None:
    # 1 -> 2 legendary: 54 * 1.8 = 97.2 -> 97 EXP; 40,80,120 -> 3 candies.
    result = level_up_cost(1, 2, curve=GrowthCurve.LEGENDARY)
    assert result.total_exp == 97
    assert result.candies == 3
    assert result.dream_shards == 42    # 3 * 14


def test_high_level_uses_25_exp_band() -> None:
    # 50 -> 51 normal: 1362 EXP; candy gives 25 EXP (band 30+); shards=309 at lvl 50.
    result = level_up_cost(50, 51)
    assert result.total_exp == 1362
    assert result.candies == 55         # 55 * 25 = 1375 >= 1362
    assert result.dream_shards == 16995  # 55 * 309


def test_target_not_greater_than_current_is_rejected() -> None:
    with pytest.raises(ValidationError):
        level_up_cost(30, 30)
    with pytest.raises(ValidationError):
        level_up_cost(40, 20)


def test_out_of_range_levels_are_rejected() -> None:
    with pytest.raises(ValidationError):
        level_up_cost(0, 10)
    with pytest.raises(ValidationError):
        level_up_cost(50, 56)
