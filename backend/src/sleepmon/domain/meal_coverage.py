"""Meal coverage for Cooking Power-Up S specialists (PRD 0024).

How often a Pokémon gets its procs before every meal of a day, and through a perfect
week (18 meals, Monday to Saturday), read from a simulated table by interpolation.
"""

from __future__ import annotations

import bisect
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final

from sleepmon.domain.meal_coverage_table import FILL_HOURS, NIGHT_MINUTES, ODDS, RAW_PROCS
from sleepmon.domain.skills import powers_up_cooking
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Specialty

TWO_PROCS_MIN_DAY: Final[float] = 0.75
_DAY, _WEEK = 0, 1


@dataclass(frozen=True, slots=True)
class CoverageOdds:
    day: float  # share of days with all 3 meals covered
    week: float  # chance of a perfect week; never above ``day``


@dataclass(frozen=True, slots=True)
class MealCoverage:
    one_proc: CoverageOdds
    two_procs: CoverageOdds | None  # only when reliable (see ``reliable_two_procs``)


def covers_meals(species: Species) -> bool:
    """Skill specialists whose main skill powers up cooking (any variant)."""
    return species.specialty is Specialty.SKILLS and powers_up_cooking(species)


def reliable_two_procs(odds: CoverageOdds) -> CoverageOdds | None:
    """2 procs per meal are shown only when they cover more than 75% of days."""
    return odds if odds.day > TWO_PROCS_MIN_DAY else None


def _bracket(axis: Sequence[float], x: float) -> tuple[int, int, float]:
    """The axis indices around ``x`` and its fraction between them, clamped to the ends."""
    if x <= axis[0]:
        return 0, 0, 0.0
    if x >= axis[-1]:
        last = len(axis) - 1
        return last, last, 0.0
    hi = bisect.bisect_right(axis, x)
    lo = hi - 1
    return lo, hi, (x - axis[lo]) / (axis[hi] - axis[lo])


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _odds(procs: int, metric: int, raw: float, fill: float, night: int) -> float:
    table = ODDS[procs - 1][metric]
    n0, n1, tn = _bracket(NIGHT_MINUTES, night)
    f0, f1, tf = _bracket(FILL_HOURS, fill)
    r0, r1, tr = _bracket(RAW_PROCS, raw)

    def by_raw(n: int, f: int) -> float:
        return _lerp(table[n][f][r0], table[n][f][r1], tr)

    def by_fill(n: int) -> float:
        return _lerp(by_raw(n, f0), by_raw(n, f1), tf)

    return _lerp(by_fill(n0), by_fill(n1), tn) / 1000


def _coverage(procs: int, raw: float, fill: float, night: int) -> CoverageOdds:
    day = _odds(procs, _DAY, raw, fill, night)
    return CoverageOdds(day=day, week=min(_odds(procs, _WEEK, raw, fill, night), day))


def meal_coverage(raw_procs_per_day: float, fill_hours: float, night_minutes: int) -> MealCoverage:
    """Coverage from helps/day x skill chance, inventory fill time and the night's length."""
    return MealCoverage(
        one_proc=_coverage(1, raw_procs_per_day, fill_hours, night_minutes),
        two_procs=reliable_two_procs(_coverage(2, raw_procs_per_day, fill_hours, night_minutes)),
    )
