import pytest

from sleepmon.domain.meal_coverage import (
    CoverageOdds,
    covers_meals,
    meal_coverage,
    reliable_two_procs,
)
from sleepmon.domain.meal_coverage_table import FILL_HOURS, NIGHT_MINUTES, RAW_PROCS, odds
from sleepmon.domain.species import SEED_SPECIES

_BY_NAME = {s.name: s for s in SEED_SPECIES}


@pytest.mark.parametrize(
    "name",
    [
        "Magnemite",
        "Magneton",
        "Magnezone",
        "Flareon",
        "Glaceon",
        "Misdreavus",
        "Mismagius",
        "Minun",
    ],
)
def test_cooking_power_up_skill_specialists_cover_meals(name: str) -> None:
    assert covers_meals(_BY_NAME[name])


@pytest.mark.parametrize("name", ["Salamence", "Luxray", "Meowscarada", "Charizard"])
def test_others_do_not(name: str) -> None:
    assert not covers_meals(_BY_NAME[name])


def test_a_grid_point_reads_its_table_value() -> None:
    n, f, r = NIGHT_MINUTES.index(510), FILL_HOURS.index(10.0), RAW_PROCS.index(5.5)
    cov = meal_coverage(5.5, 10.0, 510)
    assert cov.one_proc.day == pytest.approx(odds(1, 0, n, f, r))
    assert cov.one_proc.week == pytest.approx(odds(1, 1, n, f, r))
    assert cov.one_proc.week_one_miss == pytest.approx(odds(1, 2, n, f, r))


def test_between_grid_points_it_interpolates() -> None:
    low = meal_coverage(5.25, 10.0, 510).one_proc.day
    high = meal_coverage(5.5, 10.0, 510).one_proc.day
    assert meal_coverage(5.375, 10.0, 510).one_proc.day == pytest.approx((low + high) / 2)


def test_inputs_clamp_to_the_table() -> None:
    assert meal_coverage(30.0, 10.0, 510) == meal_coverage(12.0, 10.0, 510)
    assert meal_coverage(5.0, 40.0, 510) == meal_coverage(5.0, 14.0, 510)
    assert meal_coverage(5.0, 0.2, 510) == meal_coverage(5.0, 1.0, 510)
    assert meal_coverage(5.0, 10.0, 30) == meal_coverage(5.0, 10.0, 90)
    assert meal_coverage(5.0, 10.0, 900) == meal_coverage(5.0, 10.0, 720)


def test_no_procs_covers_nothing() -> None:
    cov = meal_coverage(0.0, 10.0, 510)
    assert cov.one_proc == CoverageOdds(0.0, 0.0, 0.0)
    assert cov.two_procs is None


def test_reference_one_proc() -> None:
    cov = meal_coverage(5.4, 10.0, 510)
    assert cov.one_proc.day == pytest.approx(0.90, abs=0.015)
    assert cov.one_proc.week == pytest.approx(0.57, abs=0.015)


def test_two_procs_shown_when_reliable() -> None:
    cov = meal_coverage(8.3, 10.0, 510)
    assert cov.two_procs is not None
    assert cov.two_procs.day == pytest.approx(0.80, abs=0.015)
    assert cov.two_procs.week == pytest.approx(0.34, abs=0.015)


def test_two_procs_hidden_below_the_bar() -> None:
    assert meal_coverage(7.0, 10.0, 510).two_procs is None


def test_two_procs_need_more_than_75_percent() -> None:
    assert reliable_two_procs(CoverageOdds(0.75, 0.2, 0.4)) is None
    assert reliable_two_procs(CoverageOdds(0.751, 0.2, 0.4)) == CoverageOdds(0.751, 0.2, 0.4)


def test_week_never_above_day() -> None:
    for raw in (1.3, 4.7, 8.1):
        cov = meal_coverage(raw, 6.5, 500)
        assert cov.one_proc.week <= cov.one_proc.day


def test_reference_one_miss() -> None:
    cov = meal_coverage(5.0, 10.0, 510).one_proc
    assert cov.day == pytest.approx(0.89, abs=0.015)
    assert cov.week == pytest.approx(0.48, abs=0.015)
    assert cov.week_one_miss == pytest.approx(0.74, abs=0.015)


def test_week_one_miss_never_below_perfect_week() -> None:
    for raw in (0.0, 1.3, 4.7, 5.0, 8.1, 12.0):
        for fill, night in ((3.0, 300), (6.5, 500), (10.0, 510)):
            cov = meal_coverage(raw, fill, night).one_proc
            assert cov.week <= cov.week_one_miss <= 1.0
