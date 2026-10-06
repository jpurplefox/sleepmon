import pytest

from sleepmon.domain.catalog_data import GOOD_CAMP_TICKET_POT_FACTOR
from sleepmon.domain.pot import pot_capacity

# Cases ported from frontend/src/pot.test.ts (same numbers the page shows today).


def test_unticketed_adds_floored_skill_share_per_meal() -> None:
    assert pot_capacity(69, 0).per_meal == 69
    pot = pot_capacity(69, 7)
    assert pot.per_meal == 71  # 69 + floor(7/3)
    assert pot.skill_per_meal == 2
    assert pot.daily == 214  # 69*3 + 7
    assert pot.base_daily == 207
    assert pot.skill_daily == 7
    assert pot.bonus_daily == 0


def test_ticket_grows_pot_half_and_rounds_up_per_meal() -> None:
    assert GOOD_CAMP_TICKET_POT_FACTOR == 1.5
    assert pot_capacity(69, 0, 1.5).per_meal == 104  # ceil(103.5)
    pot = pot_capacity(69, 7, 1.5)
    assert pot.per_meal == 107  # ceil((69 + 7/3) * 1.5)
    assert pot.daily == 321
    assert pot.bonus_daily == pytest.approx(321 - 207 - 7)


def test_ticket_and_event_multiply() -> None:
    # PRD 0012: (base + skill) * 1.5 * 2, rounded up per meal.
    pot = pot_capacity(21, 0, 1.5 * 2)
    assert pot.per_meal == 63
    assert pot.daily == 189
    assert pot.bonus_daily == 126


@pytest.mark.parametrize(
    ("size", "skill", "mult"), [(0, 0, 1.0), (21, -1, 1.0), (21, 0, 0.9)]
)
def test_guards(size: int, skill: float, mult: float) -> None:
    with pytest.raises(ValueError):
        pot_capacity(size, skill, mult)
