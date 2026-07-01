from sleepmon.domain.catalog_data import (
    ISLAND_FAVORITE_BERRIES,
    ISLAND_USER_PICKS,
)
from sleepmon.domain.value_objects import Berry, Island


def test_every_island_is_mapped() -> None:
    assert set(ISLAND_FAVORITE_BERRIES) == set(Island)


def test_normal_islands_have_exactly_three_favorites() -> None:
    for island in Island:
        favorites = ISLAND_FAVORITE_BERRIES[island]
        if island in ISLAND_USER_PICKS:
            assert favorites == ()
        else:
            assert len(favorites) == 3
            assert len(set(favorites)) == 3


def test_greengrass_islands_pick_berries() -> None:
    assert {Island.GREENGRASS_ISLE, Island.GREENGRASS_EXPERT} == ISLAND_USER_PICKS


def test_cyan_beach_favorites() -> None:
    assert ISLAND_FAVORITE_BERRIES[Island.CYAN_BEACH] == (
        Berry.ORAN,
        Berry.PAMTRE,
        Berry.PECHA,
    )


def test_amber_canyon_favorites() -> None:
    assert ISLAND_FAVORITE_BERRIES[Island.AMBER_CANYON] == (
        Berry.CHESTO,
        Berry.LUM,
        Berry.YACHE,
    )
