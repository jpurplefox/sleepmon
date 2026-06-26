import math

import pytest

from sleepmon.domain.production import daily_production
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Berry, Ingredient, Nature, SleepType, Specialty, SubSkill

I = Ingredient  # noqa: E741 — alias local para que el dataset se lea compacto

# Bonus de energía máxima (mismo valor que el dominio): 2 + 2/9.
BONUS = 2 + 2 / 9

# Cantidades por slot/ingrediente; con los ingredientes default los slots elegidos
# rinden la "diagonal" [2, 4, 6].
_AMOUNTS = ((2,), (5, 4), (7, 7, 6))
_INGREDIENTS = (I.HONEY, I.SNOOZY_TOMATO, I.SOFT_POTATO)


def _species(
    *,
    specialty: Specialty = Specialty.INGREDIENTS,
    help_frequency_seconds: float = 3600,
    ingredient_percentage: float = 20,
    skill_percentage: float = 5,
    ingredient_amounts: tuple[tuple[int, ...], ...] = _AMOUNTS,
    base_inventory: int = 100_000,  # alto: por defecto no se llena (producción plena)
) -> Species:
    return Species(
        "Tester",
        999,
        specialty,
        Berry.ORAN,
        SleepType.DOZING,
        "Test Skill",
        _INGREDIENTS,
        help_frequency_seconds,
        ingredient_percentage,
        skill_percentage,
        ingredient_amounts,
        base_inventory,
    )


def test_helps_per_day_applies_energy_bonus() -> None:
    # Nivel 1 (sin factor de nivel): 86400/3600 = 24 ayudas, x bonus 2+2/9.
    prod = daily_production(_species(help_frequency_seconds=3600), _INGREDIENTS, level=1)
    assert prod.helps_per_day == pytest.approx(24 * BONUS)


def test_higher_level_helps_more_often() -> None:
    # La frecuencia baja con el nivel: a mayor nivel, más ayudas por día.
    lvl1 = daily_production(_species(help_frequency_seconds=3600), _INGREDIENTS, level=1)
    lvl100 = daily_production(_species(help_frequency_seconds=3600), _INGREDIENTS, level=100)
    assert lvl100.helps_per_day > lvl1.helps_per_day
    # Intervalo a nivel 1: floor(3600 / (2+2/9)) = 1620 s -> 86400/1620 = 53.33 ayudas.
    assert lvl1.helps_per_day == pytest.approx(86400 / 1620)


def test_seconds_per_help_truncated_to_whole_seconds() -> None:
    # freq 4400, Lv14: 4400 * 0.974 / (2+2/9) = 1928.52 -> se trunca a 1928 s (32:08),
    # y las ayudas del día se calculan con ese entero (como RaenonX).
    prod = daily_production(_species(help_frequency_seconds=4400), _INGREDIENTS, level=14)
    assert prod.seconds_per_help == 1928
    assert prod.helps_per_day == pytest.approx(86400 / 1928)


def test_berry_rate_is_one_minus_ingredient_skill_independent() -> None:
    # Skill independiente: la baya es 1 - ingrediente; no se le resta el skill.
    prod = daily_production(
        _species(ingredient_percentage=20, skill_percentage=5), _INGREDIENTS, level=60
    )
    assert prod.berry_percentage == 80
    # Alto inventario: sin overflow -> ayudas normales = helps_per_day.
    assert prod.berry_amount == pytest.approx(prod.helps_per_day * 0.80)


def test_berry_specialty_yields_two_per_help() -> None:
    other = daily_production(_species(specialty=Specialty.INGREDIENTS), _INGREDIENTS, level=60)
    berries = daily_production(_species(specialty=Specialty.BERRIES), _INGREDIENTS, level=60)
    assert berries.berry_amount == pytest.approx(2 * other.berry_amount)


def test_amount_depends_on_chosen_ingredient_and_slot() -> None:
    # Default elige Honey/Snoozy Tomato/Soft Potato -> diagonal [2, 4, 6].
    prod = daily_production(
        _species(ingredient_percentage=30), _INGREDIENTS, level=60
    )
    helps_per_slot = prod.helps_per_day * 0.30 / 3  # alto inventario: sin overflow
    assert [s.amount for s in prod.ingredients] == pytest.approx(
        [helps_per_slot * 2, helps_per_slot * 4, helps_per_slot * 6]
    )
    # Si en el slot 2 (Lv30) elijo Honey en vez de Snoozy Tomato, rinde 5 (no 4).
    prod_honey = daily_production(
        _species(ingredient_percentage=30), (I.HONEY, I.HONEY, I.SOFT_POTATO), level=60
    )
    assert prod_honey.ingredients[1].amount == pytest.approx(helps_per_slot * 5)


def test_locked_slots_concentrate_helps_in_unlocked() -> None:
    # Nivel 1: solo el slot 1 -> todas las ayudas de ingrediente ahí (Honey ×2).
    prod = daily_production(_species(ingredient_percentage=30), _INGREDIENTS, level=1)
    assert len(prod.ingredients) == 1
    assert prod.ingredients[0].amount == pytest.approx(24 * BONUS * 0.30 / 1 * 2)


def test_level_30_unlocks_the_second_slot() -> None:
    assert len(daily_production(_species(), _INGREDIENTS, level=29).ingredients) == 1
    assert len(daily_production(_species(), _INGREDIENTS, level=30).ingredients) == 2


def _eff(p: float) -> float:
    """Tasa efectiva con pity proc (N=78), espejo del dominio."""
    return p / (1 - (1 - p) ** 78)


def _capped(lam: float, cap: int) -> float:
    """E[min(N, cap)] con N ~ Poisson(lam), espejo del dominio."""
    total, cdf_below, pmf = 0.0, 0.0, math.exp(-lam)
    for i in range(1, cap + 1):
        cdf_below += pmf
        total += 1 - cdf_below
        pmf = pmf * lam / i
    return total


def test_skill_triggers_use_effective_rate_and_night_cap() -> None:
    # freq 8000 a nivel 1 -> 1 ayuda/hora; inventario alto -> sin overflow.
    prod = daily_production(
        _species(help_frequency_seconds=8000, skill_percentage=5, base_inventory=100_000),
        _INGREDIENTS,
        level=1,
    )
    eff = _eff(0.05)
    # Día (15.5h) sin tope + noche (8.5h) con tope 1 (especie no-skill).
    assert prod.skill_triggers == pytest.approx(15.5 * eff + _capped(8.5 * eff, 1))
    assert prod.effective_skill_percentage == pytest.approx(eff * 100)
    assert prod.effective_skill_percentage > prod.skill_percentage


def test_skill_specialist_caps_skill_at_two_without_touching_berries() -> None:
    prod = daily_production(
        _species(
            specialty=Specialty.SKILLS,
            help_frequency_seconds=8000,
            ingredient_percentage=20,
            skill_percentage=50,  # alto a propósito para que el tope muerda
            base_inventory=100_000,
        ),
        _INGREDIENTS,
        level=1,
    )
    eff = _eff(0.50)
    assert prod.skill_triggers == pytest.approx(15.5 * eff + _capped(8.5 * eff, 2))
    # Skill independiente: el tope NO suma a bayas; baya = 1 - ing = 0.80, 24 ayudas.
    assert prod.berry_amount == pytest.approx(24 * 0.80 * 1)


def test_night_skill_chances_reported_per_cap() -> None:
    lam = 8.5 * _eff(0.50)  # freq 8000 a nivel 1 -> 8.5 ayudas de noche
    non_skill = daily_production(
        _species(
            specialty=Specialty.INGREDIENTS,
            help_frequency_seconds=8000,
            skill_percentage=50,
            base_inventory=100_000,
        ),
        _INGREDIENTS,
        level=1,
    )
    skill = daily_production(
        _species(
            specialty=Specialty.SKILLS,
            help_frequency_seconds=8000,
            skill_percentage=50,
            base_inventory=100_000,
        ),
        _INGREDIENTS,
        level=1,
    )
    # No-skill (tope 1): una sola chance P(>=1). Skill (tope 2): P(>=1) y P(>=2).
    assert len(non_skill.night_skill_chances) == 1
    assert non_skill.night_skill_chances[0] == pytest.approx(1 - math.exp(-lam))
    assert len(skill.night_skill_chances) == 2
    assert skill.night_skill_chances[0] == pytest.approx(1 - math.exp(-lam))
    assert skill.night_skill_chances[1] == pytest.approx(
        1 - math.exp(-lam) - lam * math.exp(-lam)
    )


def test_non_skill_caps_skill_at_one_without_touching_berries() -> None:
    prod = daily_production(
        _species(
            specialty=Specialty.INGREDIENTS,
            help_frequency_seconds=8000,
            ingredient_percentage=20,
            skill_percentage=50,
            base_inventory=100_000,
        ),
        _INGREDIENTS,
        level=1,
    )
    eff = _eff(0.50)
    assert prod.skill_triggers == pytest.approx(15.5 * eff + _capped(8.5 * eff, 1))
    assert prod.berry_amount == pytest.approx(24 * 0.80 * 1)


def test_pity_proc_raises_low_skill_rate() -> None:
    # Caso Bulbasaur: base 1.9% -> efectiva ~2.45%.
    prod = daily_production(_species(skill_percentage=1.9), _INGREDIENTS, level=60)
    assert prod.skill_percentage == 1.9
    assert prod.effective_skill_percentage == pytest.approx(2.45, abs=0.05)


def test_inventory_overflow_at_night_converts_helps_to_berries() -> None:
    # freq 8000 -> 1 ayuda/hora exacta. Inventario 4, items/ayuda = 1 -> se llena
    # en 4h. Noche 8.5h: 4h normales + 4.5h solo bayas. Día 15.5h normal.
    prod = daily_production(
        _species(
            help_frequency_seconds=8000,
            ingredient_percentage=20,
            skill_percentage=0,
            ingredient_amounts=((1,), (1, 1), (1, 1, 1)),
            base_inventory=4,
        ),
        _INGREDIENTS,
        level=1,
    )
    assert prod.helps_per_day == pytest.approx(24)
    assert prod.inventory_fill_hours == pytest.approx(4.0)
    # normal_helps = (15.5 + 4) = 19.5 ; overflow = 4.5
    assert prod.berry_amount == pytest.approx(19.5 * 0.8 + 4.5)  # 20.1
    assert sum(s.amount for s in prod.ingredients) == pytest.approx(19.5 * 0.2)  # 3.9
    assert prod.skill_triggers == pytest.approx(0)


def test_fill_helps_round_up() -> None:
    # items/ayuda = 2 (especialista en bayas, 100% baya). Inventario 5 -> 2.5 ayudas
    # -> redondea a 3 ayudas. freq 8000 -> 1 ayuda/h -> 3h para llenar.
    prod = daily_production(
        _species(
            specialty=Specialty.BERRIES,
            help_frequency_seconds=8000,
            ingredient_percentage=0,
            skill_percentage=0,
            base_inventory=5,
        ),
        _INGREDIENTS,
        level=1,
    )
    assert prod.inventory_fill_hours == pytest.approx(3.0)


def test_low_inventory_overflow_boosts_berries() -> None:
    # Menos inventario -> más overflow nocturno -> más bayas (mismas demás variables).
    high = daily_production(_species(base_inventory=100_000), _INGREDIENTS, level=60)
    low = daily_production(_species(base_inventory=2), _INGREDIENTS, level=60)
    assert low.berry_amount > high.berry_amount


def test_result_exposes_inventory_and_percentages() -> None:
    prod = daily_production(
        _species(ingredient_percentage=20, skill_percentage=5, base_inventory=11),
        _INGREDIENTS,
        level=60,
    )
    assert prod.inventory == 11
    assert prod.inventory_fill_hours > 0
    assert prod.ingredient_percentage == 20
    assert prod.skill_percentage == 5  # base
    assert prod.effective_skill_percentage == pytest.approx(_eff(0.05) * 100)
    assert prod.berry_percentage == 80  # 100 - ingrediente (skill independiente)


def test_berry_percentage_ignores_skill_and_clamps() -> None:
    # La baya NO resta skill: ing 20 + skill 50 -> baya 80 (no 30).
    assert _species(ingredient_percentage=20, skill_percentage=50).berry_percentage == 80
    # Y nunca es negativa.
    assert _species(ingredient_percentage=100, skill_percentage=0).berry_percentage == 0


def test_requires_exactly_three_ingredients() -> None:
    with pytest.raises(ValueError):
        daily_production(_species(), (I.HONEY, I.SNOOZY_TOMATO), level=60)


def test_result_carries_species_berry() -> None:
    prod = daily_production(_species(), _INGREDIENTS, level=60)
    assert prod.berry is Berry.ORAN


# --- sub skills + naturaleza ---


def test_helping_speed_subskill_lowers_interval() -> None:
    # Sub skill activa (nivel >= 10, su slot está desbloqueado): baja el intervalo.
    base = daily_production(_species(help_frequency_seconds=8000), _INGREDIENTS, level=50)
    fast = daily_production(
        _species(help_frequency_seconds=8000), _INGREDIENTS, level=50,
        sub_skills=(SubSkill.HELPING_SPEED_M,),
    )
    assert fast.seconds_per_help < base.seconds_per_help


def test_locked_subskill_is_ignored() -> None:
    # A nivel 5 la 1ra sub skill (desbloquea a 10) no aplica: igual que sin sub skill.
    base = daily_production(_species(help_frequency_seconds=8000), _INGREDIENTS, level=5)
    locked = daily_production(
        _species(help_frequency_seconds=8000), _INGREDIENTS, level=5,
        sub_skills=(SubSkill.HELPING_SPEED_M,),
    )
    assert locked.seconds_per_help == base.seconds_per_help


def test_speed_of_help_nature_lowers_interval() -> None:
    # Adamant sube Speed of Help (+10%): freq * 0.90.
    prod = daily_production(
        _species(help_frequency_seconds=8000), _INGREDIENTS, level=1, nature=Nature.ADAMANT
    )
    assert prod.seconds_per_help == 3240  # floor(8000 * 0.90 / (2+2/9))


def test_ingredient_finder_subskills_boost_ingredient_percentage() -> None:
    prod = daily_production(
        _species(ingredient_percentage=20), _INGREDIENTS, level=60,
        sub_skills=(SubSkill.INGREDIENT_FINDER_M, SubSkill.INGREDIENT_FINDER_S),
    )
    assert prod.ingredient_percentage == pytest.approx(20 * (1 + 0.36 + 0.18))  # 30.8


def test_ingredient_finding_nature_boosts_ingredient_percentage() -> None:
    # Modest sube Ingredient Finding (+20%).
    prod = daily_production(
        _species(ingredient_percentage=20), _INGREDIENTS, level=60, nature=Nature.MODEST
    )
    assert prod.ingredient_percentage == pytest.approx(20 * 1.20)  # 24


def test_nature_compounds_over_subskills_not_summed() -> None:
    # Modest sube Ingredient Finding (×1.20), compuesto sobre Ingredient Finder M (+0.36):
    # base × 1.36 × 1.20 (NO base × (1 + 0.36 + 0.20)).
    prod = daily_production(
        _species(ingredient_percentage=20), _INGREDIENTS, level=60,
        nature=Nature.MODEST, sub_skills=(SubSkill.INGREDIENT_FINDER_M,),
    )
    assert prod.ingredient_percentage == pytest.approx(20 * 1.36 * 1.20)


def test_skill_trigger_subskill_boosts_effective_skill() -> None:
    prod = daily_production(
        _species(skill_percentage=5), _INGREDIENTS, level=60,
        sub_skills=(SubSkill.SKILL_TRIGGER_M,),
    )
    # base * (1 + 0.36) = 6.8%, y recién ahí el pity proc.
    assert prod.effective_skill_percentage == pytest.approx(_eff(0.05 * 1.36) * 100)


def test_berry_finding_adds_one_berry_per_help() -> None:
    base = daily_production(
        _species(specialty=Specialty.INGREDIENTS, base_inventory=100_000), _INGREDIENTS, level=60
    )
    with_bf = daily_production(
        _species(specialty=Specialty.INGREDIENTS, base_inventory=100_000), _INGREDIENTS, level=60,
        sub_skills=(SubSkill.BERRY_FINDING_S,),
    )
    # De 1 a 2 bayas por ayuda -> duplica (mismas ayudas, inventario alto sin overflow).
    assert with_bf.berry_amount == pytest.approx(base.berry_amount * 2)


def test_inventory_up_subskills_increase_inventory() -> None:
    prod = daily_production(
        _species(base_inventory=11), _INGREDIENTS, level=60,
        sub_skills=(SubSkill.INVENTORY_UP_M, SubSkill.INVENTORY_UP_S),
    )
    assert prod.inventory == 11 + 12 + 6
