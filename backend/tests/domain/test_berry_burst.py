import pytest

from sleepmon.domain.berry_burst import BurstMember, team_context_for, teammate_berries
from sleepmon.domain.map_bonuses import MapBonuses
from sleepmon.domain.production import BerryYield, daily_production
from sleepmon.domain.skills import TeamContext
from sleepmon.domain.species import SEED_SPECIES
from sleepmon.domain.value_objects import Berry, WeeklyBonus

_BY_NAME = {s.name: s for s in SEED_SPECIES}


def _member(
    member_id: str, name: str, *, slot: int, level: int = 30, weight: float = 1.0
) -> BurstMember:
    species = _BY_NAME[name]
    first = species.ingredients[0]
    daily = daily_production(species, (first, first, first), level=level, skill_level=1)
    return BurstMember(member_id, slot, species, level, weight, daily)


def test_teammate_berry_is_valued_at_the_teammates_level() -> None:
    sceptile = _member("s", "Sceptile", slot=0)
    pikachu = _member("p", "Pikachu", slot=1)
    result = teammate_berries([sceptile, pikachu], MapBonuses())
    per_teammate = sceptile.daily.skill_berries_per_teammate
    assert per_teammate is not None
    assert result == {"s": (BerryYield(Berry.GREPA, per_teammate, per_teammate * 54),)}


def test_only_bursters_get_an_entry() -> None:
    result = teammate_berries([_member("p", "Pikachu", slot=0)], MapBonuses())
    assert result == {}


def test_burster_alone_gets_no_teammate_berries() -> None:
    assert teammate_berries([_member("s", "Sceptile", slot=0)], MapBonuses()) == {"s": ()}


def test_teammate_berry_uses_its_own_map_multiplier() -> None:
    sceptile = _member("s", "Sceptile", slot=0)
    pikachu = _member("p", "Pikachu", slot=1)
    favorite = teammate_berries(
        [sceptile, pikachu], MapBonuses(subs=frozenset({Berry.GREPA}))
    )["s"][0]
    assert favorite.strength == pytest.approx(favorite.amount * 108)
    expert_main = teammate_berries(
        [sceptile, pikachu],
        MapBonuses(main=Berry.GREPA, expert=True, weekly_bonus=WeeklyBonus.BERRY_STRENGTH),
    )["s"][0]
    assert expert_main.strength == pytest.approx(expert_main.amount * round(54 * 2.4))


def test_split_teammate_is_scaled_and_own_slot_partner_is_excluded() -> None:
    sceptile = _member("s", "Sceptile", slot=0, weight=0.5)
    partner = _member("x", "Pikachu", slot=0, weight=0.5)  # shares Sceptile's slot
    a = _member("a", "Pikachu", slot=1, weight=0.6)
    b = _member("b", "Pikachu", slot=1, weight=0.4)
    result = teammate_berries([sceptile, partner, a, b], MapBonuses())["s"]
    per_teammate = sceptile.daily.skill_berries_per_teammate
    assert per_teammate is not None
    # a (0.6) + b (0.4) merge into one Grepa yield; the slot partner adds nothing.
    assert result == (BerryYield(Berry.GREPA, per_teammate * 1.0, per_teammate * 54),)


def test_yields_merge_by_berry_and_sort_by_strength() -> None:
    sceptile = _member("s", "Sceptile", slot=0)
    pikachu = _member("p", "Pikachu", slot=1)
    dragonite = _member("d", "Dragonite", slot=2)
    result = teammate_berries([sceptile, pikachu, dragonite], MapBonuses())["s"]
    assert [y.berry for y in result] == [Berry.YACHE, Berry.GREPA]


def test_team_context_counts_distinct_dragons_and_latias_in_other_slots() -> None:
    latios = _BY_NAME["Latios"]
    roster = [
        (0, latios),
        (0, _BY_NAME["Latias"]),  # Latios's own slot partner: never together
        (1, _BY_NAME["Dratini"]),
        (2, _BY_NAME["Dragonite"]),
        (3, _BY_NAME["Dragonite"]),  # same species counts once
        (4, _BY_NAME["Pikachu"]),
    ]
    assert team_context_for(0, latios, roster) == TeamContext(
        same_berry_species=3, latias=False
    )
    with_latias = [*roster, (4, _BY_NAME["Latias"])]
    assert team_context_for(0, latios, with_latias) == TeamContext(
        same_berry_species=4, latias=True
    )


def test_team_context_counts_species_sharing_the_members_berry() -> None:
    cresselia = _BY_NAME["Cresselia"]
    roster = [
        (0, cresselia),
        (1, _BY_NAME["Ralts"]),  # Mago
        (2, _BY_NAME["Gardevoir"]),  # Mago, a different species
        (3, _BY_NAME["Gardevoir"]),  # same species counts once
        (4, _BY_NAME["Latios"]),  # Yache: doesn't count for Cresselia
    ]
    assert team_context_for(0, cresselia, roster) == TeamContext(
        same_berry_species=3, latias=False, latios=True
    )


def test_team_context_notes_latios_in_other_slots() -> None:
    latias = _BY_NAME["Latias"]
    roster = [(0, latias), (1, _BY_NAME["Latios"])]
    assert team_context_for(0, latias, roster).latios is True
    assert team_context_for(0, latias, [(0, latias), (0, _BY_NAME["Latios"])]).latios is False


def test_team_context_floor_when_alone() -> None:
    latios = _BY_NAME["Latios"]
    assert team_context_for(0, latios, [(0, latios)]) == TeamContext()
