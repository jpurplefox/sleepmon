import pytest

from sleepmon.domain.analytics import SkillEffectAgg, team_production
from sleepmon.domain.extra_tasty import expected_extra_tasty
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
    skill_tasty_chance: float | None = None,
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
        skill_tasty_chance=skill_tasty_chance,
        skill_extra_helpful=None,
        skill_random_energy=None,
        night_skill_chances=(),
        inventory=100,
        inventory_fill_hours=5.0,
    )


def test_team_production_empty() -> None:
    result = team_production([])
    assert result.member_count == 0
    assert result.total_strength == 0.0
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


def test_team_extra_tasty_baseline_without_tasty_chance() -> None:
    baseline = expected_extra_tasty([])
    result = team_production([("a", "X", _daily(skill_tasty_chance=None))])
    assert result.extra_tasty_rate == pytest.approx(baseline.rate)
    assert result.extra_tasty_multiplier == pytest.approx(baseline.multiplier)


def test_team_extra_tasty_uses_triggers_and_recovered_proc_size() -> None:
    # skill_tasty_chance = disparos × tamaño_pp → tamaño = 56.6 / 5.66 = 10 pp.
    daily = _daily(skill_triggers=5.66, skill_tasty_chance=56.6)
    result = team_production([("a", "X", daily)])
    expected = expected_extra_tasty([(5.66, 10.0)])
    assert result.extra_tasty_rate == pytest.approx(expected.rate)
    assert result.extra_tasty_multiplier == pytest.approx(expected.multiplier)


def test_team_extra_tasty_combines_contributors_into_shared_stack() -> None:
    a = _daily(skill_triggers=2.83, skill_tasty_chance=28.3)  # tamaño 10 pp
    b = _daily(skill_triggers=2.83, skill_tasty_chance=28.3)
    result = team_production([("a", "X", a), ("b", "Y", b)])
    expected = expected_extra_tasty([(2.83, 10.0), (2.83, 10.0)])
    assert result.extra_tasty_rate == pytest.approx(expected.rate)


def test_team_production_member_breakdown() -> None:
    daily = _daily(berry_strength=100.0, skill_strength=20.0)
    result = team_production([("id-a", "Pikachu", daily)])
    member = result.members[0]
    assert member.member_id == "id-a"
    assert member.species == "Pikachu"
    assert member.strength == 120.0


def test_team_production_skill_ingredients_folded_into_aggregation() -> None:
    """skill_ingredients deben sumarse a ingredients junto con los slots normales."""
    from sleepmon.domain.production import DailyProduction

    # Miembro A: slot normal de HONEY(3.0) + skill_ingredient FANCY_EGG(4.0)
    a = DailyProduction(
        helps_per_day=50.0,
        seconds_per_help=3000,
        berry=Berry.BELUE,
        berry_amount=10.0,
        berry_strength=100.0,
        berry_percentage=80.0,
        ingredient_percentage=20.0,
        skill_percentage=5.0,
        effective_skill_percentage=6.0,
        ingredients=(SlotProduction(I.HONEY, 3.0),),
        skill_triggers=2.0,
        skill_ingredients=(SlotProduction(I.FANCY_EGG, 4.0),),
        skill_energy=None,
        skill_ingredient_total=None,
        skill_cooking_ingredients=None,
        skill_strength=None,
        skill_self_energy=None,
        skill_dream_shards=None,
        skill_tasty_chance=None,
        skill_extra_helpful=None,
        skill_random_energy=None,
        night_skill_chances=(),
        inventory=100,
        inventory_fill_hours=5.0,
    )
    # Miembro B: slot normal de HONEY(2.0) + skill_ingredient HONEY(1.0)
    b = DailyProduction(
        helps_per_day=50.0,
        seconds_per_help=3000,
        berry=Berry.BELUE,
        berry_amount=10.0,
        berry_strength=100.0,
        berry_percentage=80.0,
        ingredient_percentage=20.0,
        skill_percentage=5.0,
        effective_skill_percentage=6.0,
        ingredients=(SlotProduction(I.HONEY, 2.0),),
        skill_triggers=2.0,
        skill_ingredients=(SlotProduction(I.HONEY, 1.0),),
        skill_energy=None,
        skill_ingredient_total=None,
        skill_cooking_ingredients=None,
        skill_strength=None,
        skill_self_energy=None,
        skill_dream_shards=None,
        skill_tasty_chance=None,
        skill_extra_helpful=None,
        skill_random_energy=None,
        night_skill_chances=(),
        inventory=100,
        inventory_fill_hours=5.0,
    )
    result = team_production([("a", "X", a), ("b", "Y", b)])
    # HONEY: 3 (slot A) + 2 (slot B) + 1 (skill B) = 6.0
    assert result.ingredients[I.HONEY] == 6.0
    # FANCY_EGG: 4 (skill A) = 4.0
    assert result.ingredients[I.FANCY_EGG] == 4.0
    assert result.total_ingredients == 10.0


# ── skill_effects ──────────────────────────────────────────────────────────────


def test_skill_effects_empty_when_no_contributors() -> None:
    """Ningún miembro aporta ningún efecto → skill_effects vacío."""
    result = team_production([("a", "X", _daily(skill_energy=None, skill_strength=None))])
    assert result.skill_effects == ()


def test_skill_effects_energy_only_contributing_member() -> None:
    """Un miembro con skill_energy y otro sin ella → entry 'energy' solo del primero."""
    a = _daily(skill_energy=10.0, skill_triggers=3.0)
    b = _daily(skill_energy=None, skill_triggers=1.5)
    result = team_production([("a", "X", a), ("b", "Y", b)])

    kinds = {e.kind: e for e in result.skill_effects}
    assert "energy" in kinds
    energy = kinds["energy"]
    assert energy.total == 10.0
    assert energy.triggers == 3.0  # solo los disparos de 'a'


def test_skill_effects_strength_entry() -> None:
    """Un miembro con skill_strength → entry 'strength' con su total y triggers."""
    a = _daily(skill_strength=200.0, skill_triggers=2.0)
    result = team_production([("a", "X", a)])

    kinds = {e.kind: e for e in result.skill_effects}
    assert "strength" in kinds
    assert kinds["strength"].total == 200.0
    assert kinds["strength"].triggers == 2.0


def test_skill_effects_two_energy_contributors_summed() -> None:
    """Dos miembros con skill_energy → total y triggers sumados."""
    a = _daily(skill_energy=10.0, skill_triggers=3.0)
    b = _daily(skill_energy=5.0, skill_triggers=1.5)
    result = team_production([("a", "X", a), ("b", "Y", b)])

    kinds = {e.kind: e for e in result.skill_effects}
    assert "energy" in kinds
    assert kinds["energy"].total == 15.0
    assert kinds["energy"].triggers == 4.5


def test_skill_effects_absent_kind_not_emitted() -> None:
    """Un kind sin ningún contribuidor no aparece en skill_effects."""
    a = _daily(skill_energy=10.0)
    result = team_production([("a", "X", a)])
    kinds = {e.kind for e in result.skill_effects}
    assert "strength" not in kinds
    assert "dream_shards" not in kinds


def test_skill_effects_stable_order() -> None:
    """skill_effects sigue el orden canónico de kinds (strength antes que energy)."""
    a = _daily(skill_strength=100.0, skill_energy=50.0, skill_triggers=2.0)
    result = team_production([("a", "X", a)])
    kinds_order = [e.kind for e in result.skill_effects]
    assert kinds_order.index("strength") < kinds_order.index("energy")


def test_skill_effects_is_tuple_of_skill_effect_agg() -> None:
    """skill_effects es una tupla de SkillEffectAgg."""
    a = _daily(skill_energy=10.0)
    result = team_production([("a", "X", a)])
    assert isinstance(result.skill_effects, tuple)
    assert all(isinstance(e, SkillEffectAgg) for e in result.skill_effects)


# ── bonus de isla ──────────────────────────────────────────────────────────────


def _sample_entries() -> list[tuple[str, str, DailyProduction]]:
    """Entries de muestra para tests de bonus de isla."""
    a = _daily(berry_strength=100.0, skill_strength=50.0)
    b = _daily(berry_strength=200.0, skill_strength=None)
    return [("id-a", "Pikachu", a), ("id-b", "Bulbasaur", b)]


def test_island_bonus_scales_all_strength() -> None:
    entries = _sample_entries()
    base = team_production(entries)
    boosted = team_production(entries, island_bonus=0.5)

    assert boosted.total_berry_strength_base == base.total_berry_strength
    assert boosted.total_berry_strength == pytest.approx(base.total_berry_strength * 1.5)
    assert boosted.total_skill_strength == pytest.approx(base.total_skill_strength * 1.5)
    assert boosted.total_strength == pytest.approx(base.total_strength * 1.5)
    assert boosted.island_bonus == 0.5


def test_member_strength_has_base_and_boosted() -> None:
    entries = _sample_entries()
    boosted = team_production(entries, island_bonus=0.85)
    for member in boosted.members:
        assert member.strength == pytest.approx(member.strength_base * 1.85)


def test_zero_bonus_is_identity() -> None:
    entries = _sample_entries()
    base = team_production(entries)
    assert base.island_bonus == 0.0
    assert base.total_strength == base.total_strength_base
    for member in base.members:
        assert member.strength == member.strength_base
