from sleepmon.domain.meal_coverage_table import FILL_HOURS, NIGHT_MINUTES, ODDS, RAW_PROCS


def test_axes() -> None:
    assert tuple(range(90, 721, 30)) == NIGHT_MINUTES
    assert tuple(float(h) for h in range(1, 15)) == FILL_HOURS
    assert tuple(i / 4 for i in range(49)) == RAW_PROCS


def test_shape_and_range() -> None:
    assert len(ODDS) == 2
    for per_k in ODDS:
        assert len(per_k) == 2
        for metric in per_k:
            assert len(metric) == len(NIGHT_MINUTES)
            for night in metric:
                assert len(night) == len(FILL_HOURS)
                for row in night:
                    assert len(row) == len(RAW_PROCS)
                    assert all(0 <= v <= 1000 for v in row)


def test_no_procs_covers_nothing() -> None:
    for per_k in ODDS:
        for metric in per_k:
            for night in metric:
                for row in night:
                    assert row[0] == 0


def test_monotone_in_raw_and_fill() -> None:
    for per_k in ODDS:
        for metric in per_k:
            for night in metric:
                for row in night:
                    assert list(row) == sorted(row)
                for r in range(len(RAW_PROCS)):
                    column = [night[f][r] for f in range(len(FILL_HOURS))]
                    assert column == sorted(column)


def test_perfect_week_never_above_day() -> None:
    for per_k in ODDS:
        day, week = per_k
        for n in range(len(NIGHT_MINUTES)):
            for f in range(len(FILL_HOURS)):
                for r in range(len(RAW_PROCS)):
                    assert week[n][f][r] <= day[n][f][r]
