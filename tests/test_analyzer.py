from sleepmon import SleepSession, sleep_efficiency, summarize


def make(asleep: int, in_bed: int = 480, awakenings: int = 1) -> SleepSession:
    return SleepSession(
        date="2026-06-25",
        time_in_bed_min=in_bed,
        asleep_min=asleep,
        awakenings=awakenings,
    )


def test_efficiency_basic() -> None:
    assert sleep_efficiency(make(asleep=432, in_bed=480)) == 90.0


def test_efficiency_zero_time_in_bed() -> None:
    assert sleep_efficiency(make(asleep=0, in_bed=0)) == 0.0


def test_summarize_empty() -> None:
    assert summarize([]) == {"nights": 0, "avg_asleep_min": 0.0, "avg_efficiency": 0.0}


def test_summarize_aggregates() -> None:
    out = summarize([make(asleep=420), make(asleep=480)])
    assert out["nights"] == 2
    assert out["avg_asleep_min"] == 450.0
