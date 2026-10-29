import base64

from sleepmon.domain.meal_coverage_table import (
    FILL_HOURS,
    METRICS,
    NIGHT_MINUTES,
    ODDS_B64,
    RAW_PROCS,
    SCALE,
    odds,
)

_N, _F, _R = len(NIGHT_MINUTES), len(FILL_HOURS), len(RAW_PROCS)
_DAY, _WEEK, _ONE_MISS = 0, 1, 2


def _cells() -> list[tuple[int, int, int, int, int]]:
    return [
        (k, m, n, f, r)
        for k in (1, 2)
        for m in range(METRICS)
        for n in range(_N)
        for f in range(_F)
        for r in range(_R)
    ]


def test_axes() -> None:
    assert tuple(range(90, 721, 30)) == NIGHT_MINUTES
    assert tuple(float(h) for h in range(1, 15)) == FILL_HOURS
    assert tuple(i / 4 for i in range(49)) == RAW_PROCS


def test_shape_and_encoding() -> None:
    assert METRICS == 3
    assert SCALE == 250
    assert len(base64.b64decode(ODDS_B64)) == 2 * 3 * _N * _F * _R


def test_every_value_is_a_share() -> None:
    assert all(0.0 <= odds(*cell) <= 1.0 for cell in _cells())


def test_no_procs_covers_nothing() -> None:
    for k in (1, 2):
        for m in range(METRICS):
            for n in range(_N):
                for f in range(_F):
                    assert odds(k, m, n, f, 0) == 0.0


def test_monotone_in_raw_and_fill() -> None:
    for k in (1, 2):
        for m in range(METRICS):
            for n in range(_N):
                for f in range(_F):
                    row = [odds(k, m, n, f, r) for r in range(_R)]
                    assert row == sorted(row)
                for r in range(_R):
                    column = [odds(k, m, n, f, r) for f in range(_F)]
                    assert column == sorted(column)


def test_week_never_above_day_or_one_miss() -> None:
    for k, _, n, f, r in _cells():
        week = odds(k, _WEEK, n, f, r)
        assert week <= odds(k, _DAY, n, f, r)
        assert week <= odds(k, _ONE_MISS, n, f, r)
