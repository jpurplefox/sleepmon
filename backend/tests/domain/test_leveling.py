import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.leveling import (
    LEVEL_UP_TARGETS,
    MAX_LEVELABLE_LEVEL,
    exp_modifier,
    level_up_cost,
    target_level,
)
from sleepmon.domain.value_objects import ExpNatureModifier, GrowthCurve, Nature

N, UP, DOWN = ExpNatureModifier.NEUTRAL, ExpNatureModifier.UP, ExpNatureModifier.DOWN


def cost(current: int, target: int, **kw: object) -> tuple[int, int]:
    c = level_up_cost(current, target, **kw)  # type: ignore[arg-type]
    return c.candies, c.dream_shards


def test_verified_against_the_game_23_to_24() -> None:
    # In-game screenshot: 15 candies take a level-23 Minun to 24 for 1,320 shards.
    assert cost(23, 24) == (15, 1320)


def test_minimal_span_carries_overflow() -> None:
    assert cost(1, 2) == (2, 28)
    assert cost(1, 3) == (4, 64)


@pytest.mark.parametrize(
    ("current", "target", "kw", "expected"),
    [
        (1, 10, {}, (39, 1384)),
        (15, 25, {}, (129, 9987)),
        (15, 25, {"nature": UP}, (107, 8273)),
        (15, 25, {"nature": DOWN}, (151, 11680)),
        (15, 25, {"curve": GrowthCurve.PSEUDO_LEGENDARY}, (193, 14935)),
        (15, 25, {"curve": GrowthCurve.LEGENDARY}, (231, 17879)),
        (15, 25, {"curve": GrowthCurve.MYTHICAL}, (283, 21913)),
        (25, 30, {}, (95, 10054)),
        (15, 60, {}, (1803, 535149)),
        (60, 70, {}, (1227, 1141655)),
        (69, 70, {}, (131, 166632)),
        (10, 11, {}, (9, 450)),
    ],
)
def test_prd_costs(
    current: int, target: int, kw: dict[str, object], expected: tuple[int, int]
) -> None:
    assert cost(current, target, **kw) == expected


@pytest.mark.parametrize(("current", "target"), [(1, 1), (5, 5), (5, 4), (0, 5), (1, 71)])
def test_invalid_spans_raise(current: int, target: int) -> None:
    with pytest.raises(ValidationError):
        level_up_cost(current, target)


def test_targets_and_cap() -> None:
    assert MAX_LEVELABLE_LEVEL == 70
    assert LEVEL_UP_TARGETS == (10, 25, 30, 50, 60, 70)


@pytest.mark.parametrize(
    ("level", "minimum", "expected"),
    [
        (15, None, 25),
        (25, None, 30),
        (9, None, 10),
        (1, None, 10),
        (15, 60, 60),
        (60, 60, 70),
        (65, 60, 70),
        (69, None, 70),
        (70, None, None),
        (85, 60, None),
        (42, 10, 50),
    ],
)
def test_target_level(level: int, minimum: int | None, expected: int | None) -> None:
    assert target_level(level, minimum) == expected


@pytest.mark.parametrize(
    ("nature", "expected"),
    [(Nature.TIMID, UP), (Nature.BRAVE, DOWN), (Nature.ADAMANT, N), (None, N)],
)
def test_exp_modifier(nature: Nature | None, expected: ExpNatureModifier) -> None:
    assert exp_modifier(nature) == expected
