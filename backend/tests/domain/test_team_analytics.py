from sleepmon.domain.analytics import team_production
from sleepmon.domain.production import DailyProduction, SlotProduction
from sleepmon.domain.value_objects import Berry, Ingredient

I = Ingredient  # noqa: E741


def _daily(
    *,
    berry_amount: float = 10.0,
    berry_strength: float = 100.0,
    ingredients: tuple[SlotProduction, ...] = (),
    skill_triggers: float = 2.0,
    skill_strength: float | None = None,
    skill_energy: float | None = None,
) -> DailyProduction:
    return DailyProduction(
        helps_per_day=50.0,
        seconds_per_help=3000,
        berry=Berry.BELUE,
        berry_amount=berry_amount,
        berry_strength=berry_strength,
        berry_percentage=80.0,
        ingredient_percentage=20.0,
        skill_percentage=5.0,
        effective_skill_percentage=6.0,
        ingredients=ingredients,
        skill_triggers=skill_triggers,
        skill_ingredients=(),
        skill_energy=skill_energy,
        skill_ingredient_total=None,
        skill_cooking_ingredients=None,
        skill_strength=skill_strength,
        skill_self_energy=None,
        skill_dream_shards=None,
        skill_tasty_chance=None,
        skill_extra_helpful=None,
        skill_random_energy=None,
        night_skill_chances=(),
        inventory=100,
        inventory_fill_hours=5.0,
    )


def test_team_production_empty() -> None:
    result = team_production([])
    assert result.member_count == 0
    assert result.total_strength == 0
    assert result.ingredients == {}


def test_team_production_sums_strength_and_berries() -> None:
    a = _daily(berry_strength=100.0, skill_strength=50.0)
    b = _daily(berry_strength=200.0, skill_strength=None)
    result = team_production([("id-a", "Pikachu", a), ("id-b", "Bulbasaur", b)])
    assert result.member_count == 2
    assert result.total_berry_strength == 300.0
    assert result.total_skill_strength == 50.0
    assert result.total_strength == 350.0  # 300 bayas + 50 skill


def test_team_production_aggregates_ingredients_by_type() -> None:
    a = _daily(ingredients=(SlotProduction(I.HONEY, 3.0), SlotProduction(I.FANCY_EGG, 2.0)))
    b = _daily(ingredients=(SlotProduction(I.HONEY, 5.0),))
    result = team_production([("a", "X", a), ("b", "Y", b)])
    assert result.ingredients[I.HONEY] == 8.0
    assert result.ingredients[I.FANCY_EGG] == 2.0
    assert result.total_ingredients == 10.0


def test_team_production_optional_metric_none_when_nobody_contributes() -> None:
    result = team_production([("a", "X", _daily(skill_energy=None))])
    assert result.skill_energy is None


def test_team_production_optional_metric_sums_present() -> None:
    result = team_production(
        [("a", "X", _daily(skill_energy=10.0)), ("b", "Y", _daily(skill_energy=5.0))]
    )
    assert result.skill_energy == 15.0


def test_team_production_member_breakdown() -> None:
    daily = _daily(berry_strength=100.0, skill_strength=20.0)
    result = team_production([("id-a", "Pikachu", daily)])
    member = result.members[0]
    assert member.member_id == "id-a"
    assert member.species == "Pikachu"
    assert member.strength == 120.0
