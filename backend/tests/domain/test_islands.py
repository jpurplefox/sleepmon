from sleepmon.domain.catalog_data import (
    ISLAND_EXPERT,
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


def test_user_picks_are_greengrass_and_the_expert_areas() -> None:
    assert {
        Island.GREENGRASS_ISLE,
        Island.GREENGRASS_EXPERT,
        Island.CYAN_BEACH_EXPERT,
    } == ISLAND_USER_PICKS


def test_expert_areas_are_greengrass_expert_and_cyan_beach_expert() -> None:
    assert {Island.GREENGRASS_EXPERT, Island.CYAN_BEACH_EXPERT} == ISLAND_EXPERT


def test_every_expert_area_lets_the_user_pick() -> None:
    assert ISLAND_EXPERT <= ISLAND_USER_PICKS


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
