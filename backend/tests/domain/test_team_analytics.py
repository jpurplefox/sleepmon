import dataclasses

import pytest

from sleepmon.domain.analytics import BerrySource, SkillEffectAgg, team_production
from sleepmon.domain.extra_tasty import expected_extra_tasty
from sleepmon.domain.production import (
    BerryYield,
    DailyProduction,
    SlotProduction,
    daily_production,
    scale_daily,
)
from sleepmon.domain.species import SEED_SPECIES
from sleepmon.domain.value_objects import Berry, Ingredient

I = Ingredient  # noqa: E741


def _fake_daily(
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
        effective_skill_level=1,
    )


def test_team_production_empty() -> None:
    result = team_production([])
    assert result.member_count == 0
    assert result.total_strength == 0.0
    assert result.ingredients == {}


def test_team_production_sums_strength_and_berries() -> None:
    a = _fake_daily(berry_strength=100.0, skill_strength=50.0)
    b = _fake_daily(berry_strength=200.0, skill_strength=None)
    result = team_production([("id-a", "Pikachu", a), ("id-b", "Bulbasaur", b)])
    assert result.member_count == 2
    assert result.total_berry_strength == 300.0
    assert result.total_skill_strength == 50.0
    assert result.total_strength == 350.0  # 300 bayas + 50 skill


def test_team_production_aggregates_ingredients_by_type() -> None:
    a = _fake_daily(ingredients=(SlotProduction(I.HONEY, 3.0), SlotProduction(I.FANCY_EGG, 2.0)))
    b = _fake_daily(ingredients=(SlotProduction(I.HONEY, 5.0),))
    result = team_production([("a", "X", a), ("b", "Y", b)])
    assert result.ingredients[I.HONEY] == 8.0
    assert result.ingredients[I.FANCY_EGG] == 2.0
    assert result.total_ingredients == 10.0


def test_team_production_optional_metric_none_when_nobody_contributes() -> None:
    result = team_production([("a", "X", _fake_daily(skill_energy=None))])
    assert result.skill_energy is None


def test_team_production_optional_metric_sums_present() -> None:
    result = team_production(
        [("a", "X", _fake_daily(skill_energy=10.0)), ("b", "Y", _fake_daily(skill_energy=5.0))]
    )
    assert result.skill_energy == 15.0


def test_team_extra_tasty_baseline_without_tasty_chance() -> None:
    baseline = expected_extra_tasty([])
    result = team_production([("a", "X", _fake_daily(skill_tasty_chance=None))])
    assert result.extra_tasty_rate == pytest.approx(baseline.rate)
    assert result.extra_tasty_multiplier == pytest.approx(baseline.multiplier)


def test_team_extra_tasty_uses_triggers_and_recovered_proc_size() -> None:
    # skill_tasty_chance = disparos × tamaño_pp → tamaño = 56.6 / 5.66 = 10 pp.
    daily = _fake_daily(skill_triggers=5.66, skill_tasty_chance=56.6)
    result = team_production([("a", "X", daily)])
    expected = expected_extra_tasty([(5.66, 10.0)])
    assert result.extra_tasty_rate == pytest.approx(expected.rate)
    assert result.extra_tasty_multiplier == pytest.approx(expected.multiplier)


def test_team_extra_tasty_combines_contributors_into_shared_stack() -> None:
    a = _fake_daily(skill_triggers=2.83, skill_tasty_chance=28.3)  # tamaño 10 pp
    b = _fake_daily(skill_triggers=2.83, skill_tasty_chance=28.3)
    result = team_production([("a", "X", a), ("b", "Y", b)])
    expected = expected_extra_tasty([(2.83, 10.0), (2.83, 10.0)])
    assert result.extra_tasty_rate == pytest.approx(expected.rate)


def test_team_production_member_breakdown() -> None:
    daily = _fake_daily(berry_strength=100.0, skill_strength=20.0)
    result = team_production([("id-a", "Pikachu", daily)])
    member = result.members[0]
    assert member.id == "id-a"
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
        effective_skill_level=1,
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
        effective_skill_level=1,
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
    result = team_production([("a", "X", _fake_daily(skill_energy=None, skill_strength=None))])
    assert result.skill_effects == ()


def test_skill_effects_energy_only_contributing_member() -> None:
    """Un miembro con skill_energy y otro sin ella → entry 'energy' solo del primero."""
    a = _fake_daily(skill_energy=10.0, skill_triggers=3.0)
    b = _fake_daily(skill_energy=None, skill_triggers=1.5)
    result = team_production([("a", "X", a), ("b", "Y", b)])

    kinds = {e.kind: e for e in result.skill_effects}
    assert "energy" in kinds
    energy = kinds["energy"]
    assert energy.total == 10.0
    assert energy.triggers == 3.0  # solo los disparos de 'a'


def test_granted_helps_are_not_repeated_as_a_skill_effect() -> None:
    # Already turned into production by the team pass; no "other skills" line.
    helper = dataclasses.replace(_fake_daily(), skill_extra_helpful=12.0)
    result = team_production([("id-a", "Arcanine", helper)])
    assert "extra_helpful" not in {e.kind for e in result.skill_effects}
    assert not hasattr(result, "skill_extra_helpful")


def test_skill_effects_include_candy_and_berry_juice() -> None:
    delibird = dataclasses.replace(_fake_daily(skill_triggers=3.0), skill_candy=4.0)
    shuckle = dataclasses.replace(_fake_daily(skill_triggers=2.0), skill_berry_juice=0.37)
    result = team_production([("d", "Delibird", delibird), ("s", "Shuckle", shuckle)])
    kinds = {e.kind: e for e in result.skill_effects}
    assert kinds["candy"] == SkillEffectAgg(kind="candy", total=4.0, triggers=3.0)
    assert kinds["berry_juice"] == SkillEffectAgg(kind="berry_juice", total=0.37, triggers=2.0)


def test_skill_effects_strength_entry() -> None:
    """Un miembro con skill_strength → entry 'strength' con su total y triggers."""
    a = _fake_daily(skill_strength=200.0, skill_triggers=2.0)
    result = team_production([("a", "X", a)])

    kinds = {e.kind: e for e in result.skill_effects}
    assert "strength" in kinds
    assert kinds["strength"].total == 200.0
    assert kinds["strength"].triggers == 2.0


def test_skill_effects_two_energy_contributors_summed() -> None:
    """Dos miembros con skill_energy → total y triggers sumados."""
    a = _fake_daily(skill_energy=10.0, skill_triggers=3.0)
    b = _fake_daily(skill_energy=5.0, skill_triggers=1.5)
    result = team_production([("a", "X", a), ("b", "Y", b)])

    kinds = {e.kind: e for e in result.skill_effects}
    assert "energy" in kinds
    assert kinds["energy"].total == 15.0
    assert kinds["energy"].triggers == 4.5


def test_skill_effects_absent_kind_not_emitted() -> None:
    """Un kind sin ningún contribuidor no aparece en skill_effects."""
    a = _fake_daily(skill_energy=10.0)
    result = team_production([("a", "X", a)])
    kinds = {e.kind for e in result.skill_effects}
    assert "strength" not in kinds
    assert "dream_shards" not in kinds


def test_skill_effects_stable_order() -> None:
    """skill_effects sigue el orden canónico de kinds (strength antes que energy)."""
    a = _fake_daily(skill_strength=100.0, skill_energy=50.0, skill_triggers=2.0)
    result = team_production([("a", "X", a)])
    kinds_order = [e.kind for e in result.skill_effects]
    assert kinds_order.index("strength") < kinds_order.index("energy")


def test_skill_effects_is_tuple_of_skill_effect_agg() -> None:
    """skill_effects es una tupla de SkillEffectAgg."""
    a = _fake_daily(skill_energy=10.0)
    result = team_production([("a", "X", a)])
    assert isinstance(result.skill_effects, tuple)
    assert all(isinstance(e, SkillEffectAgg) for e in result.skill_effects)


# ── bonus de isla ──────────────────────────────────────────────────────────────


def _sample_entries() -> list[tuple[str, str, DailyProduction]]:
    """Entries de muestra para tests de bonus de isla."""
    a = _fake_daily(berry_strength=100.0, skill_strength=50.0)
    b = _fake_daily(berry_strength=200.0, skill_strength=None)
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


def test_two_half_weight_copies_equal_one_full_member() -> None:
    d = _fake_daily(
        berry_amount=10.0,
        berry_strength=100.0,
        ingredients=(SlotProduction(I.HONEY, 8.0),),
        skill_triggers=4.0,
        skill_strength=20.0,
    )
    full = team_production([("a", "X", d)])
    split = team_production(
        [("a", "X", scale_daily(d, 0.5)), ("b", "Y", scale_daily(d, 0.5))]
    )
    assert split.total_strength == pytest.approx(full.total_strength)
    assert split.total_berry_amount == pytest.approx(full.total_berry_amount)
    assert split.total_ingredients == pytest.approx(full.total_ingredients)
    assert split.skill_triggers == pytest.approx(full.skill_triggers)
    assert split.ingredients[I.HONEY] == pytest.approx(full.ingredients[I.HONEY])


# ── Berry Burst team berry rows ────────────────────────────────────────────────────

_SPECIES = {s.name: s for s in SEED_SPECIES}


def _daily(name: str, level: int = 30) -> DailyProduction:
    species = _SPECIES[name]
    first = species.ingredients[0]
    return daily_production(species, (first, first, first), level=level, skill_level=1)


def _with_teammates(daily: DailyProduction, *yields: BerryYield) -> DailyProduction:
    return dataclasses.replace(daily, teammate_berries=yields)


def test_berry_rows_split_helps_and_berry_burst() -> None:
    sceptile = _daily("Sceptile")
    pikachu = _daily("Pikachu")
    grepa = BerryYield(Berry.GREPA, 3.0, 162.0)
    team = team_production(
        [("s", "Sceptile", _with_teammates(sceptile, grepa)), ("p", "Pikachu", pikachu)]
    )
    rows = {r.berry: r for r in team.berries}
    durin, grepa_row = rows[Berry.DURIN], rows[Berry.GREPA]
    assert durin.sources[0] == BerrySource(
        "helps", None, None,
        sceptile.berry_amount - sceptile.skill_berry_amount,
        pytest.approx(sceptile.berry_strength - sceptile.skill_berry_strength),
    )
    assert durin.sources[1] == BerrySource(
        "skill", "s", "Sceptile",
        sceptile.skill_berry_amount, pytest.approx(sceptile.skill_berry_strength),
    )
    assert grepa_row.amount == pytest.approx(pikachu.berry_amount + 3.0)
    assert grepa_row.strength_base == pytest.approx(pikachu.berry_strength + 162.0)
    assert grepa_row.sources[1] == BerrySource("skill", "s", "Sceptile", 3.0, 162.0)


def test_berry_rows_merge_own_skill_berries_and_teammate_yield_of_the_same_berry() -> None:
    sceptile = _daily("Sceptile")
    merged = _with_teammates(sceptile, BerryYield(Berry.DURIN, 3.0, 300.0))
    team = team_production([("s", "Sceptile", merged)])
    durin = next(r for r in team.berries if r.berry == Berry.DURIN)
    bursts = [s for s in durin.sources if s.kind == "skill"]
    assert len(bursts) == 1
    assert bursts[0].member_id == "s"
    assert bursts[0].amount == pytest.approx(sceptile.skill_berry_amount + 3.0)
    assert bursts[0].strength_base == pytest.approx(sceptile.skill_berry_strength + 300.0)


def test_row_without_berry_burst_has_only_helps() -> None:
    team = team_production([("p", "Pikachu", _daily("Pikachu"))])
    (row,) = team.berries
    assert [s.kind for s in row.sources] == ["helps"]


def test_teammate_berries_count_once_in_the_totals() -> None:
    sceptile = _with_teammates(_daily("Sceptile"), BerryYield(Berry.GREPA, 3.0, 162.0))
    pikachu = _daily("Pikachu")
    team = team_production(
        [("s", "Sceptile", sceptile), ("p", "Pikachu", pikachu)], island_bonus=0.5
    )
    expected_berry_base = sceptile.berry_strength + 162.0 + pikachu.berry_strength
    assert team.total_berry_strength_base == pytest.approx(expected_berry_base)
    # Pikachu has Charge Strength S, so total_skill_strength_base is not 0
    assert team.total_skill_strength_base == pytest.approx(pikachu.skill_strength or 0.0)
    expected_total_base = expected_berry_base + (pikachu.skill_strength or 0.0)
    assert team.total_strength == pytest.approx(expected_total_base * 1.5)
    assert sum(r.strength_base for r in team.berries) == pytest.approx(expected_berry_base)
    assert sum(r.strength for r in team.berries) == pytest.approx(expected_berry_base * 1.5)
    member = next(m for m in team.members if m.id == "s")
    assert member.strength_base == pytest.approx(sceptile.berry_strength + 162.0)
    assert member.berry_amount == pytest.approx(sceptile.berry_amount + 3.0)


def test_berry_rows_sort_by_strength() -> None:
    team = team_production(
        [("p", "Pikachu", _daily("Pikachu", 10)), ("d", "Dragonite", _daily("Dragonite", 60))]
    )
    strengths = [r.strength for r in team.berries]
    assert strengths == sorted(strengths, reverse=True)


def test_berry_rows_with_equal_strength_sort_by_berry_name() -> None:
    """Rows with equal strength sort deterministically by berry name."""
    base = dataclasses.replace(
        _daily("Pikachu"),
        berry_amount=10.0,
        berry_strength=100.0,
        skill_berry_amount=None,
        skill_berry_strength=None,
        teammate_berries=(),
    )
    # The later name goes first, so only the tie-break puts CHERI before ORAN.
    daily_oran = dataclasses.replace(base, berry=Berry.ORAN)
    daily_cheri = dataclasses.replace(base, berry=Berry.CHERI)
    team = team_production([("o", "O", daily_oran), ("c", "C", daily_cheri)])
    assert team.berries[0].strength == team.berries[1].strength
    assert [r.berry for r in team.berries] == [Berry.CHERI, Berry.ORAN]
