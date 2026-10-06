import pytest

from sleepmon.domain.berry_burst import BurstMember
from sleepmon.domain.production import daily_production
from sleepmon.domain.species import SEED_SPECIES
from sleepmon.domain.team_helps import extra_help_yields
from sleepmon.domain.value_objects import Berry, Ingredient

_BY_NAME = {s.name: s for s in SEED_SPECIES}


def _member(
    member_id: str, name: str, *, slot: int, level: int = 30, weight: float = 1.0
) -> BurstMember:
    species = _BY_NAME[name]
    first = species.ingredients[0]
    daily = daily_production(species, (first, first, first), level=level, skill_level=1)
    return BurstMember(member_id, slot, species, level, weight, daily)


def _helps(member: BurstMember) -> float:
    total = member.daily.skill_extra_helpful
    assert total is not None
    return total


def test_only_extra_helpful_members_get_an_entry() -> None:
    result = extra_help_yields([_member("p", "Pikachu", slot=0), _member("s", "Sceptile", slot=1)])
    assert result == {}


def test_helps_split_evenly_across_occupied_slots_self_included() -> None:
    arcanine = _member("a", "Arcanine", slot=0)
    pikachu = _member("p", "Pikachu", slot=1)
    result = extra_help_yields([arcanine, pikachu])["a"]
    share = _helps(arcanine) / 2

    # Its own share: its own berries and ingredients.
    own = arcanine.daily.help_yield
    assert result.own_berries == pytest.approx(share * own.berries)
    assert result.own_berry_strength == pytest.approx(share * own.berry_strength)
    # Pikachu's share: Pikachu's berries, valued as Pikachu's.
    mate = pikachu.daily.help_yield
    assert len(result.teammate_berries) == 1
    grepa = result.teammate_berries[0]
    assert grepa.berry is Berry.GREPA
    assert grepa.amount == pytest.approx(share * mate.berries)
    assert grepa.strength == pytest.approx(share * mate.berry_strength)
    # Ingredients from both shares, merged by type.
    expected: dict[Ingredient, float] = {}
    for y in (own, mate):
        for slot in y.ingredients:
            expected[slot.ingredient] = expected.get(slot.ingredient, 0.0) + share * slot.amount
    assert {s.ingredient: s.amount for s in result.ingredients} == pytest.approx(expected)


def test_alone_it_helps_only_itself() -> None:
    arcanine = _member("a", "Arcanine", slot=0)
    result = extra_help_yields([arcanine])["a"]
    assert result.own_berries == pytest.approx(_helps(arcanine) * arcanine.daily.help_yield.berries)
    assert result.teammate_berries == ()


def test_split_slots_share_by_weight_and_own_slot_is_all_self() -> None:
    arcanine = _member("a", "Arcanine", slot=0, weight=0.5)
    partner = _member("x", "Pikachu", slot=0, weight=0.5)  # never on the team with it
    a = _member("p", "Pikachu", slot=1, weight=0.6)
    b = _member("s", "Sceptile", slot=1, weight=0.4)
    result = extra_help_yields([arcanine, partner, a, b])["a"]
    share = _helps(arcanine) / 2  # two occupied slots

    assert result.own_berries == pytest.approx(share * arcanine.daily.help_yield.berries)
    by_berry = {y.berry: y.amount for y in result.teammate_berries}
    assert by_berry == pytest.approx(
        {
            Berry.GREPA: share * 0.6 * a.daily.help_yield.berries,
            Berry.DURIN: share * 0.4 * b.daily.help_yield.berries,
        }
    )
