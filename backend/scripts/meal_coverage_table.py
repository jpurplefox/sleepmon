"""Generate src/sleepmon/domain/meal_coverage_table.py (PRD 0024).

Simulates the meal coverage routine for Cooking Power-Up S specialists in 5-minute
steps over a grid of (procs per meal, night, inventory fill), every raw rate at once,
and writes the table the domain interpolates. Dev-only: needs numpy.

    pip install -e ".[dev]" && python scripts/meal_coverage_table.py

Routine: wake 7:00; bedtime = 7:00 - night. Meals planned 7:00, 12:00, 18:00 wait for
their procs until 12:00, 18:00 and bedtime (4:00 at the latest), then count as missed.
While the pot is short, collect every 2 h awake (plus at meals and bedtime); once it is
covered, stop collecting, and after cooking collect, so stored procs go to the next meal.
Asleep: no collecting, at most 2 procs. A full inventory stops skill rolls.
"""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

STEP_MIN = 5
STEPS_PER_DAY = 24 * 60 // STEP_MIN
DAYS_PER_WEEK = 6  # Sundays don't need procs
WEEKS = 4
RUNS = 4000
NIGHT_CAP = 2
NIGHT_MINUTES = tuple(range(90, 721, 30))
FILL_HOURS = tuple(float(h) for h in range(1, 15))
RAW_PROCS = tuple(i / 4 for i in range(49))
OUT = Path(__file__).resolve().parents[1] / "src" / "sleepmon" / "domain" / "meal_coverage_table.py"


def step(hours: float) -> int:
    return int(round(hours * 60 / STEP_MIN))


def simulate(job: tuple[int, int, float]) -> tuple[np.ndarray, np.ndarray]:
    """Day and perfect-week shares for every raw rate, at one (k, night, fill)."""
    k, night_minutes, fill_hours = job
    bed = step(24 - night_minutes / 60)  # hours after waking
    checks = {step(h) for h in range(0, 24, 2) if step(h) < bed} | {0, step(5), step(11), bed}
    if step(21) < bed:
        checks.add(step(21))  # dinner's deadline is an awake check on short nights
    planned = np.array([0, step(5), step(11), 10**9])
    deadline = np.array([step(5), step(11), min(bed, step(21)), 10**9])

    rng = np.random.default_rng(7)  # same draws for every job: smooth across the grid
    lanes = len(RAW_PROCS) * RUNS
    rate_per_hour = np.repeat(np.array(RAW_PROCS) / 24, RUNS)
    p = (1 - np.exp(-rate_per_hour * STEP_MIN / 60)).astype(np.float32)
    fill = step(fill_hours)
    pot = np.zeros(lanes, np.int16)
    stored = np.zeros(lanes, np.int16)
    since = np.zeros(lanes, np.int32)
    night = np.zeros(lanes, np.int16)
    days = 1 + WEEKS * DAYS_PER_WEEK  # first day is warm-up
    missed = np.zeros((lanes, days - 1), np.int8)

    def collect(mask: np.ndarray) -> None:
        pot[mask] = np.minimum(pot[mask] + stored[mask], k)
        stored[mask] = 0
        since[mask] = 0

    for day in range(days):
        meal = np.zeros(lanes, np.int64)
        ok = np.zeros((3, lanes), bool)
        for s in range(STEPS_PER_DAY):
            if s in checks:
                for _ in range(3):  # a late meal may be followed by the next one at once
                    due = s >= planned[meal]
                    collect(due & (pot < k))
                    good = due & (pot >= k)
                    cooked = good | (due & (s >= deadline[meal]))
                    for m in range(3):
                        ok[m] |= good & (meal == m)
                    pot[cooked] = 0
                    collect(cooked)  # banked procs go to the next meal
                    meal[cooked] += 1
                collect(pot < k)  # still hunting
            if s == bed:
                night[:] = 0
            can_roll = since < fill
            if s >= bed:
                can_roll &= night < NIGHT_CAP
            proc = can_roll & (rng.random(lanes, dtype=np.float32) < p)
            stored += proc
            if s >= bed:
                night += proc
            since += 1
        if day >= 1:
            missed[:, day - 1] = 3 - ok.sum(axis=0)

    perfect_day = (missed == 0).reshape(len(RAW_PROCS), RUNS * (days - 1)).mean(axis=1)
    per_week = missed.reshape(lanes, WEEKS, DAYS_PER_WEEK).sum(axis=2)
    perfect_week = (per_week == 0).reshape(len(RAW_PROCS), RUNS * WEEKS).mean(axis=1)
    return perfect_day, perfect_week


def build() -> np.ndarray:
    """odds[k-1, metric, night, fill, raw] in 0..1, smoothed to the table's invariants."""
    jobs = [(k, n, f) for k in (1, 2) for n in NIGHT_MINUTES for f in FILL_HOURS]
    odds = np.zeros((2, 2, len(NIGHT_MINUTES), len(FILL_HOURS), len(RAW_PROCS)))
    with ProcessPoolExecutor() as pool:
        for (k, n, f), (d, w) in zip(jobs, pool.map(simulate, jobs), strict=True):
            ni, fi = NIGHT_MINUTES.index(n), FILL_HOURS.index(f)
            odds[k - 1, 0, ni, fi] = d
            odds[k - 1, 1, ni, fi] = w
        print(f"done {len(jobs)} jobs")
    odds[..., 0] = 0.0  # no procs, no coverage
    odds = np.maximum.accumulate(odds, axis=4)  # more procs never hurts
    odds = np.maximum.accumulate(odds, axis=3)  # more inventory never hurts
    odds[:, 1] = np.minimum(odds[:, 1], odds[:, 0])  # a perfect week needs good days
    return odds


def render(odds: np.ndarray) -> str:
    ints = np.rint(odds * 1000).astype(int)
    lines = [
        '"""Meal coverage odds (PRD 0024).',
        "",
        "Generated by scripts/meal_coverage_table.py: do not edit by hand.",
        '"""',
        "",
        "from typing import Final",
        "",
    ]
    for name, annotation, values in (
        ("NIGHT_MINUTES", "int", NIGHT_MINUTES),
        ("FILL_HOURS", "float", FILL_HOURS),
        ("RAW_PROCS", "float", RAW_PROCS),
    ):
        lines.append(f"{name}: Final[tuple[{annotation}, ...]] = (")
        for i in range(0, len(values), 10):
            lines.append("    " + ", ".join(repr(x) for x in values[i : i + 10]) + ",")
        lines.append(")")
    lines += [
        "",
        "# ODDS[procs_per_meal - 1][metric][night][fill][raw]; metric 0 = day, 1 = week;",
        "# per mille.",
        "ODDS: Final[tuple[tuple[tuple[tuple[tuple[int, ...], ...], ...], ...], ...]] = (",
    ]
    for per_k in ints:
        lines.append("    (")
        for metric in per_k:
            lines.append("        (")
            for night in metric:
                lines.append("            (")
                for row in night:
                    lines.append("                (")
                    for i in range(0, len(row), 12):
                        chunk = ", ".join(str(v) for v in row[i : i + 12])
                        lines.append(f"                    {chunk},")
                    lines.append("                ),")
                lines.append("            ),")
            lines.append("        ),")
        lines.append("    ),")
    lines.append(")")
    return "\n".join(lines) + "\n"


def main() -> None:
    odds = build()
    OUT.write_text(render(odds))
    ni, fi = NIGHT_MINUTES.index(510), FILL_HOURS.index(10.0)
    for k, raw in ((1, 5.5), (2, 8.25)):
        ri = RAW_PROCS.index(raw)
        print(f"k={k} raw={raw} fill=10h night=8:30 -> "
              f"day {odds[k - 1, 0, ni, fi, ri]:.3f} week {odds[k - 1, 1, ni, fi, ri]:.3f}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
