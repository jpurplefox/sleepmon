import math

import pytest

from sleepmon.domain.production import daily_production
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import (
    Berry,
    Ingredient,
    Nature,
    Ribbon,
    SleepType,
    Specialty,
    SubSkill,
)

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
    evolution_stage: int = 0,
    line_evolutions: int = 2,  # línea de 3 etapas por defecto (≥ evolution_stage)
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
        evolution_stage,
        line_evolutions,
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


def _eff(p: float, n: int = 78) -> float:
    """Tasa efectiva con pity proc (N ayudas), espejo del dominio. N=78 por defecto
    (no especialistas); los especialistas en skill tienen su propio N."""
    return p / (1 - (1 - p) ** n)


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
    # Especialista en skill con freq base 8000 -> pity propio round(140000/8000)=18.
    eff = _eff(0.50, 18)
    assert prod.skill_triggers == pytest.approx(15.5 * eff + _capped(8.5 * eff, 2))
    # Skill independiente: el tope NO suma a bayas; baya = 1 - ing = 0.80, 24 ayudas.
    assert prod.berry_amount == pytest.approx(24 * 0.80 * 1)


def test_night_skill_chances_reported_per_cap() -> None:
    # freq 8000 a nivel 1 -> 8.5 ayudas de noche. El no-skill usa pity 78; el
    # especialista en skill usa su pity propio round(140000/8000)=18.
    lam_ns = 8.5 * _eff(0.50)
    lam_sk = 8.5 * _eff(0.50, 18)
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
    assert non_skill.night_skill_chances[0] == pytest.approx(1 - math.exp(-lam_ns))
    assert len(skill.night_skill_chances) == 2
    assert skill.night_skill_chances[0] == pytest.approx(1 - math.exp(-lam_sk))
    assert skill.night_skill_chances[1] == pytest.approx(
        1 - math.exp(-lam_sk) - lam_sk * math.exp(-lam_sk)
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


def test_skill_specialist_uses_own_pity_cap_from_base_frequency() -> None:
    # Un especialista en skill rápido (freq base 2100 -> pity 67) llega al pity más
    # seguido que un no-especialista (pity fijo 78), así que con la MISMA tasa base
    # baja su tasa efectiva es mayor. Caso Raikou: 1.9% -> ~2.6%.
    common = dict(skill_percentage=1.9, help_frequency_seconds=2100)
    skill = daily_production(
        _species(specialty=Specialty.SKILLS, **common), _INGREDIENTS, level=60
    )
    non_skill = daily_production(
        _species(specialty=Specialty.INGREDIENTS, **common), _INGREDIENTS, level=60
    )
    assert skill.effective_skill_percentage == pytest.approx(2.6, abs=0.1)
    assert skill.effective_skill_percentage > non_skill.effective_skill_percentage


def test_high_base_rate_skill_specialist_barely_uses_pity() -> None:
    # Tasa base alta (12.5%): la skill procea sola antes del pity, así que efectiva ≈ base.
    prod = daily_production(
        _species(specialty=Specialty.SKILLS, skill_percentage=12.5, help_frequency_seconds=3400),
        _INGREDIENTS,
        level=60,
    )
    assert prod.effective_skill_percentage == pytest.approx(12.5, abs=0.2)


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


def test_inventory_never_fills_without_items_per_help() -> None:
    # Caso degenerado: 100% ingrediente (berry_rate=0) con cantidades de ingrediente
    # nulas -> items_per_help=0. El inventario no se llena nunca, así que el tiempo de
    # llenado toma la noche entera (rama else de `items_per_help > 0`).
    prod = daily_production(
        _species(ingredient_percentage=100, ingredient_amounts=((0,), (0, 0), (0, 0, 0))),
        _INGREDIENTS,
        level=60,
    )
    assert prod.inventory_fill_hours == pytest.approx(8.5)  # NIGHT_HOURS: no se llena


def test_low_inventory_overflow_boosts_berries() -> None:
    # Menos inventario -> más overflow nocturno -> más bayas (mismas demás variables).
    high = daily_production(_species(base_inventory=100_000), _INGREDIENTS, level=60)
    low = daily_production(_species(base_inventory=2), _INGREDIENTS, level=60)
    assert low.berry_amount > high.berry_amount


def test_evolution_bonus_adds_to_effective_inventory() -> None:
    # El inventario efectivo parte de carry_limit = base + 5*evoluciones. Sin sub
    # skills, con una evolución el tope sube +5 respecto a la forma base.
    base = daily_production(_species(base_inventory=11, evolution_stage=0), _INGREDIENTS, level=60)
    once = daily_production(_species(base_inventory=11, evolution_stage=1), _INGREDIENTS, level=60)
    twice = daily_production(_species(base_inventory=11, evolution_stage=2), _INGREDIENTS, level=60)
    assert base.inventory == 11
    assert once.inventory == 16
    assert twice.inventory == 21


@pytest.mark.parametrize(
    ("ribbon", "expected"),
    [
        (Ribbon.NONE, 11),
        (Ribbon.SLEEP_200, 12),  # +1
        (Ribbon.SLEEP_500, 14),  # +1+2
        (Ribbon.SLEEP_1000, 17),  # +1+2+3
        (Ribbon.SLEEP_2000, 19),  # +1+2+3+2 (acumulativo)
    ],
)
def test_ribbon_raises_inventory_by_tier(ribbon: Ribbon, expected: int) -> None:
    prod = daily_production(
        _species(base_inventory=11), _INGREDIENTS, level=60, ribbon=ribbon
    )
    assert prod.inventory == expected


def test_ribbon_speed_bonus_scales_with_evolutions_remaining() -> None:
    # 500h acelera según las evoluciones que le QUEDAN: 5% si puede 1 vez, 11% si
    # puede 2. Una forma sin evoluciones pendientes no recibe nada.
    def helps(remaining: int, ribbon: Ribbon = Ribbon.SLEEP_500) -> float:
        # stage 0 + line=remaining -> le quedan `remaining` evoluciones.
        sp = _species(help_frequency_seconds=3600, evolution_stage=0, line_evolutions=remaining)
        return daily_production(sp, _INGREDIENTS, level=1, ribbon=ribbon).helps_per_day

    no_ribbon = helps(2, Ribbon.NONE)
    assert helps(0) == no_ribbon  # sin evoluciones pendientes: el listón no acelera
    assert helps(1) > no_ribbon  # 5%
    assert helps(2) > helps(1)  # 11% > 5%


def test_fully_evolved_pokemon_gets_no_ribbon_speed_bonus() -> None:
    # Regresión: una forma final (stage == line, p. ej. Venusaur) no recibe velocidad
    # del listón, aunque su línea tenga 2 evoluciones. Sí mantiene el bonus de inventario.
    sp = _species(help_frequency_seconds=3600, evolution_stage=2, line_evolutions=2)
    no_ribbon = daily_production(sp, _INGREDIENTS, level=1, ribbon=Ribbon.NONE)
    ribboned = daily_production(sp, _INGREDIENTS, level=1, ribbon=Ribbon.SLEEP_2000)
    assert ribboned.seconds_per_help == no_ribbon.seconds_per_help  # misma velocidad
    assert ribboned.inventory > no_ribbon.inventory  # pero más inventario


def test_ribbon_and_helping_speed_combine_multiplicatively() -> None:
    # Caso Ivysaur Nv.60 (le queda 1 evolución): freq base 3300, Helping Speed S (0.07)
    # y listón 2000h (acumulado 0.05+0.07 = 0.12). El listón es un factor APARTE, no se
    # suma con las sub skills: (1-0.07)*(1-0.12) = 0.8184, no (1-0.19) = 0.81.
    #   floor(3300 * 0.882 * 0.8184 / (2+2/9)) = 1071 s = 17:51 (igual que RaenonX),
    #   no 1060 s = 17:40 (que daría el modelo aditivo).
    sp = _species(help_frequency_seconds=3300, evolution_stage=1, line_evolutions=2)
    prod = daily_production(
        sp, _INGREDIENTS, level=60, sub_skills=(SubSkill.HELPING_SPEED_S,), ribbon=Ribbon.SLEEP_2000
    )
    assert prod.seconds_per_help == 1071


def test_ribbon_2000h_speed_stronger_than_500h() -> None:
    sp = _species(help_frequency_seconds=3600, line_evolutions=2)
    base = daily_production(sp, _INGREDIENTS, level=1, ribbon=Ribbon.NONE)
    h500 = daily_production(sp, _INGREDIENTS, level=1, ribbon=Ribbon.SLEEP_500)
    h2000 = daily_production(sp, _INGREDIENTS, level=1, ribbon=Ribbon.SLEEP_2000)
    # 14% (2000h) acelera más que 11% (500h), y ambos más rápido que sin listón.
    assert h2000.seconds_per_help < h500.seconds_per_help < base.seconds_per_help


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


@pytest.mark.parametrize("level", [0, -50, 101])
def test_level_out_of_range_rejected(level: int) -> None:
    # Función pura reusable: reguarda el rango de nivel por su cuenta (no rinde un
    # cálculo silenciosamente erróneo con level<=0).
    with pytest.raises(ValueError, match="nivel"):
        daily_production(_species(), _INGREDIENTS, level=level)


def test_zero_skill_rate_yields_zero_effective_skill() -> None:
    # base_rate <= 0 (skill_percentage=0): la tasa efectiva es 0 directo, sin pity proc.
    prod = daily_production(_species(skill_percentage=0), _INGREDIENTS, level=60)
    assert prod.effective_skill_percentage == 0
    assert prod.skill_triggers == pytest.approx(0)


def test_sub_skills_beyond_five_slots_are_ignored() -> None:
    # Corte POSICIONAL: la 6ta sub skill (índice >= len(SUB_SKILL_UNLOCK_LEVELS)) se
    # descarta sin reventar, aunque a nivel 80 todos los slots por nivel estén abiertos.
    five = (
        SubSkill.HELPING_SPEED_M,
        SubSkill.INVENTORY_UP_S,
        SubSkill.SKILL_TRIGGER_S,
        SubSkill.INGREDIENT_FINDER_S,
        SubSkill.BERRY_FINDING_S,
    )
    base = daily_production(
        _species(help_frequency_seconds=8000), _INGREDIENTS, level=80, sub_skills=five
    )
    with_sixth = daily_production(
        _species(help_frequency_seconds=8000), _INGREDIENTS, level=80,
        sub_skills=(*five, SubSkill.HELPING_SPEED_S),  # la 6ta (otra speed) se ignora
    )
    assert with_sixth.seconds_per_help == base.seconds_per_help


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


def test_speed_lowering_nature_raises_interval() -> None:
    # Modest BAJA Speed of Help: freq * 1.075 -> intervalo mayor (rama 'decreased').
    base = daily_production(_species(help_frequency_seconds=8000), _INGREDIENTS, level=1)
    slow = daily_production(
        _species(help_frequency_seconds=8000), _INGREDIENTS, level=1, nature=Nature.MODEST
    )
    assert slow.seconds_per_help == math.floor(8000 * 1.075 / BONUS)
    assert slow.seconds_per_help > base.seconds_per_help


def test_ingredient_lowering_nature_reduces_ingredient_percentage() -> None:
    # Adamant BAJA Ingredient Finding (×0.80) (rama 'decreased').
    prod = daily_production(
        _species(ingredient_percentage=20), _INGREDIENTS, level=60, nature=Nature.ADAMANT
    )
    assert prod.ingredient_percentage == pytest.approx(20 * 0.80)  # 16


def test_main_skill_chance_nature_scales_effective_skill() -> None:
    # _NATURE_SKILL en ambos sentidos: Calm SUBE Main Skill Chance (×1.20) y Naughty
    # la BAJA (×0.80). El factor entra antes del pity proc.
    base = daily_production(_species(skill_percentage=5), _INGREDIENTS, level=60)
    up = daily_production(_species(skill_percentage=5), _INGREDIENTS, level=60, nature=Nature.CALM)
    down = daily_production(
        _species(skill_percentage=5), _INGREDIENTS, level=60, nature=Nature.NAUGHTY
    )
    assert up.effective_skill_percentage == pytest.approx(_eff(0.05 * 1.20) * 100)
    assert down.effective_skill_percentage == pytest.approx(_eff(0.05 * 0.80) * 100)
    assert (
        down.effective_skill_percentage
        < base.effective_skill_percentage
        < up.effective_skill_percentage
    )


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
