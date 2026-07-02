from sleepmon.domain.catalog_data import ISLAND_RATING_THRESHOLDS, ratings_for
from sleepmon.domain.value_objects import Island, RatingTier


def test_every_island_has_35_ratings() -> None:
    assert set(ISLAND_RATING_THRESHOLDS) == set(Island)
    for island in Island:
        assert len(ratings_for(island)) == 35


def test_tier_structure_is_basic_great_ultra_master() -> None:
    expected = (
        [(RatingTier.BASIC, i) for i in range(1, 6)]
        + [(RatingTier.GREAT, i) for i in range(1, 6)]
        + [(RatingTier.ULTRA, i) for i in range(1, 6)]
        + [(RatingTier.MASTER, i) for i in range(1, 21)]
    )
    for island in Island:
        got = [(r.tier, r.level) for r in ratings_for(island)]
        assert got == expected


def test_first_rating_is_zero_and_strengths_strictly_increasing() -> None:
    for island in Island:
        ratings = ratings_for(island)
        assert ratings[0].required_strength == 0
        strengths = [r.required_strength for r in ratings]
        assert all(a < b for a, b in zip(strengths, strengths[1:], strict=False))


def test_master_20_known_anchors() -> None:
    def m20(island: Island) -> int:
        return ratings_for(island)[-1].required_strength

    assert m20(Island.GREENGRASS_ISLE) == 3_245_795
    assert m20(Island.GREENGRASS_EXPERT) == 10_981_171
    assert m20(Island.AMBER_CANYON) == 8_528_976
