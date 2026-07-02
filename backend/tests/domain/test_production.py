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
    main_skill: str = "Test Skill",
    ingredients: tuple[Ingredient, ...] = _INGREDIENTS,
) -> Species:
    return Species(
        "Tester",
        999,
        specialty,
        Berry.ORAN,
        SleepType.DOZING,
        main_skill,
        ingredients,
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


def test_favorite_berry_doubles_berry_strength() -> None:
    species = _species()  # usar el helper del archivo — berry es Berry.ORAN
    base = daily_production(species, _INGREDIENTS, level=10)
    favored = daily_production(
        species,
        _INGREDIENTS,
        level=10,
        favorite_berries=frozenset({species.berry}),
    )
    assert favored.berry_strength == base.berry_strength * 2


def test_non_favorite_berry_unchanged() -> None:
    species = _species()
    base = daily_production(species, _INGREDIENTS, level=10)
    other = daily_production(
        species,
        _INGREDIENTS,
        level=10,
        favorite_berries=frozenset({Berry.YACHE})  # baya distinta a Berry.ORAN
        if species.berry is not Berry.YACHE
        else frozenset({Berry.ORAN}),
    )
    assert other.berry_strength == base.berry_strength


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


# --- Ingredient Draw S: ingredientes producidos por la main skill ---------------

_DRAW_INGREDIENTS = (I.GLOSSY_AVOCADO, I.SOFT_POTATO, I.PURE_OIL)


def test_skill_ingredients_empty_when_skill_does_not_draw() -> None:
    # La main skill por defecto ("Test Skill") no produce ingredientes.
    prod = daily_production(_species(), _INGREDIENTS, level=60)
    assert prod.skill_ingredients == ()


def test_ingredient_draw_s_produces_each_pool_ingredient() -> None:
    # Pool de 3 ingredientes distintos; cada disparo entrega amount(nivel)/3 de cada uno.
    species = _species(main_skill="Ingredient Draw S", ingredients=_DRAW_INGREDIENTS)
    prod = daily_production(species, _DRAW_INGREDIENTS, level=60, skill_level=7)

    assert [s.ingredient for s in prod.skill_ingredients] == list(_DRAW_INGREDIENTS)
    expected_each = prod.skill_triggers * 18 / 3  # nivel 7 -> 18 ingredientes por disparo
    for slot in prod.skill_ingredients:
        assert slot.amount == pytest.approx(expected_each)


def test_ingredient_draw_amount_scales_with_skill_level() -> None:
    species = _species(main_skill="Ingredient Draw S", ingredients=_DRAW_INGREDIENTS)
    lvl1 = daily_production(species, _DRAW_INGREDIENTS, level=60, skill_level=1)
    lvl7 = daily_production(species, _DRAW_INGREDIENTS, level=60, skill_level=7)
    # Mismos disparos (skill_level no afecta la frecuencia), 5 vs 18 por disparo.
    assert lvl1.skill_ingredients[0].amount == pytest.approx(lvl1.skill_triggers * 5 / 3)
    assert lvl7.skill_ingredients[0].amount == pytest.approx(lvl7.skill_triggers * 18 / 3)
    assert lvl1.skill_triggers == pytest.approx(lvl7.skill_triggers)


def test_ingredient_draw_default_skill_level_is_one() -> None:
    species = _species(main_skill="Ingredient Draw S", ingredients=_DRAW_INGREDIENTS)
    prod = daily_production(species, _DRAW_INGREDIENTS, level=60)  # skill_level por defecto = 1
    assert prod.skill_ingredients[0].amount == pytest.approx(prod.skill_triggers * 5 / 3)


def test_ingredient_draw_variant_with_passive_also_draws() -> None:
    # Las variantes con pasivo ("(Super Luck)", "(Hyper Cutter)") sortean igual.
    species = _species(main_skill="Ingredient Draw S (Super Luck)", ingredients=_DRAW_INGREDIENTS)
    prod = daily_production(species, _DRAW_INGREDIENTS, level=60, skill_level=3)
    assert len(prod.skill_ingredients) == 3
    assert prod.skill_ingredients[0].amount == pytest.approx(prod.skill_triggers * 8 / 3)


def test_ingredient_draw_pool_dedupes_repeated_ingredients() -> None:
    # Si la especie repite un ingrediente, el pool lo cuenta una sola vez (reparte /2).
    dup = (I.SOFT_POTATO, I.SOFT_POTATO, I.PURE_OIL)
    species = _species(main_skill="Ingredient Draw S", ingredients=dup)
    prod = daily_production(species, dup, level=60, skill_level=7)
    assert [s.ingredient for s in prod.skill_ingredients] == [I.SOFT_POTATO, I.PURE_OIL]
    for slot in prod.skill_ingredients:
        assert slot.amount == pytest.approx(prod.skill_triggers * 18 / 2)


# --- Energy for Everyone S: energía restaurada al equipo por la skill -----------


def test_skill_energy_none_when_skill_does_not_restore_energy() -> None:
    prod = daily_production(_species(), _INGREDIENTS, level=60)
    assert prod.skill_energy is None


def test_energy_for_everyone_restores_per_trigger_amount() -> None:
    species = _species(main_skill="Energy for Everyone S", specialty=Specialty.SKILLS)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    # Nivel 6 -> 18 de energía a cada compañero por disparo.
    assert prod.skill_energy == pytest.approx(prod.skill_triggers * 18)


def test_energy_for_everyone_scales_with_skill_level() -> None:
    species = _species(main_skill="Energy for Everyone S", specialty=Specialty.SKILLS)
    lvl1 = daily_production(species, _INGREDIENTS, level=60, skill_level=1)
    lvl6 = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    assert lvl1.skill_energy == pytest.approx(lvl1.skill_triggers * 5)
    assert lvl6.skill_energy == pytest.approx(lvl6.skill_triggers * 18)


def test_energy_for_everyone_clamps_level_seven_to_six() -> None:
    species = _species(main_skill="Energy for Everyone S", specialty=Specialty.SKILLS)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_energy == pytest.approx(prod.skill_triggers * 18)  # tope nivel 6


def test_energy_for_everyone_does_not_produce_skill_ingredients() -> None:
    species = _species(main_skill="Energy for Everyone S", specialty=Specialty.SKILLS)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    assert prod.skill_ingredients == ()


# --- Ingredient Magnet S: total de ingredientes al azar por la skill ------------


def test_skill_ingredient_total_none_when_skill_does_not_magnet() -> None:
    prod = daily_production(_species(), _INGREDIENTS, level=60)
    assert prod.skill_ingredient_total is None


def test_ingredient_magnet_total_is_triggers_times_amount() -> None:
    species = _species(main_skill="Ingredient Magnet S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_ingredient_total == pytest.approx(prod.skill_triggers * 24)  # nivel 7 -> 24
    # Magnet no desglosa por ingrediente ni restaura energía.
    assert prod.skill_ingredients == ()
    assert prod.skill_energy is None


def test_ingredient_magnet_total_scales_with_skill_level() -> None:
    species = _species(main_skill="Ingredient Magnet S")
    lvl1 = daily_production(species, _INGREDIENTS, level=60, skill_level=1)
    lvl7 = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert lvl1.skill_ingredient_total == pytest.approx(lvl1.skill_triggers * 6)
    assert lvl7.skill_ingredient_total == pytest.approx(lvl7.skill_triggers * 24)


# --- Cooking Power-Up S: ingredientes extra de pote por la skill ---------------


def test_skill_cooking_none_when_skill_does_not_power_up_cooking() -> None:
    prod = daily_production(_species(), _INGREDIENTS, level=60)
    assert prod.skill_cooking_ingredients is None


def test_cooking_power_up_total_is_triggers_times_amount() -> None:
    species = _species(main_skill="Cooking Power-Up S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_cooking_ingredients == pytest.approx(prod.skill_triggers * 31)  # nivel 7
    # No desglosa ingredientes, no restaura energía, no es magnet.
    assert prod.skill_ingredients == ()
    assert prod.skill_energy is None
    assert prod.skill_ingredient_total is None


def test_cooking_power_up_scales_with_skill_level() -> None:
    species = _species(main_skill="Cooking Power-Up S")
    lvl1 = daily_production(species, _INGREDIENTS, level=60, skill_level=1)
    lvl7 = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert lvl1.skill_cooking_ingredients == pytest.approx(lvl1.skill_triggers * 7)
    assert lvl7.skill_cooking_ingredients == pytest.approx(lvl7.skill_triggers * 31)


# --- Charge Strength S / M: fuerza por la skill --------------------------------


def test_skill_strength_none_when_not_charge_strength() -> None:
    assert daily_production(_species(), _INGREDIENTS, level=60).skill_strength is None


def test_charge_strength_s_total_is_triggers_times_fixed_amount() -> None:
    species = _species(main_skill="Charge Strength S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_strength == pytest.approx(prod.skill_triggers * 3212)  # nivel 7 fijo
    # No mezcla con los otros mecanismos.
    assert prod.skill_ingredients == ()
    assert prod.skill_energy is None
    assert prod.skill_cooking_ingredients is None


def test_charge_strength_m_uses_m_table() -> None:
    species = _species(main_skill="Charge Strength M")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_strength == pytest.approx(prod.skill_triggers * 6858)


def test_charge_strength_random_total_uses_midpoint() -> None:
    species = _species(main_skill="Charge Strength S (Random)")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_strength == pytest.approx(prod.skill_triggers * 4015)  # mid de 1606..6424


def test_charge_strength_stockpile_not_estimated() -> None:
    species = _species(main_skill="Charge Strength S (Stockpile)")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_strength is None


# --- Charge Energy S: energía al propio Pokémon --------------------------------


def test_skill_self_energy_none_when_not_charge_energy() -> None:
    assert daily_production(_species(), _INGREDIENTS, level=60).skill_self_energy is None


def test_charge_energy_total_is_triggers_times_amount() -> None:
    species = _species(main_skill="Charge Energy S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    assert prod.skill_self_energy == pytest.approx(prod.skill_triggers * 43)  # nivel 6
    # No se cruza con la energía al equipo (E4E) ni con los otros mecanismos.
    assert prod.skill_energy is None
    assert prod.skill_strength is None


def test_charge_energy_clamps_level_seven_to_six() -> None:
    species = _species(main_skill="Charge Energy S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_self_energy == pytest.approx(prod.skill_triggers * 43)


# --- Dream Shard Magnet S: fragmentos de sueño por la skill --------------------


def test_skill_dream_shards_none_when_not_dream_shard() -> None:
    assert daily_production(_species(), _INGREDIENTS, level=60).skill_dream_shards is None


def test_dream_shard_fixed_total_is_triggers_times_amount() -> None:
    species = _species(main_skill="Dream Shard Magnet S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=8)
    assert prod.skill_dream_shards == pytest.approx(prod.skill_triggers * 2500)  # nivel 8


def test_dream_shard_random_total_uses_midpoint() -> None:
    species = _species(main_skill="Dream Shard Magnet S (Random)")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=8)
    assert prod.skill_dream_shards == pytest.approx(prod.skill_triggers * 2875)  # mid 1150..4600


# --- Tasty Chance S: aumento de Extra Tasty (% acumulado, sin tope) ------------


def test_skill_tasty_chance_none_when_not_tasty_chance() -> None:
    assert daily_production(_species(), _INGREDIENTS, level=60).skill_tasty_chance is None


def test_tasty_chance_accumulates_with_triggers() -> None:
    species = _species(main_skill="Tasty Chance S", skill_percentage=2)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    assert prod.skill_tasty_chance == pytest.approx(prod.skill_triggers * 10)


def test_tasty_chance_not_capped() -> None:
    # Muchos disparos (skill % alto): el acumulado pasa de 70% sin acotar.
    species = _species(main_skill="Tasty Chance S", skill_percentage=80)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    assert prod.skill_tasty_chance == pytest.approx(prod.skill_triggers * 10)
    assert prod.skill_tasty_chance > 70


# --- Extra Helpful S: multiplicador de ayuda total del día --------------------


def test_skill_extra_helpful_none_when_not_extra_helpful() -> None:
    assert daily_production(_species(), _INGREDIENTS, level=60).skill_extra_helpful is None


def test_extra_helpful_total_is_triggers_times_multiplier() -> None:
    species = _species(main_skill="Extra Helpful S")
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_extra_helpful == pytest.approx(prod.skill_triggers * 12)  # nivel 7 -> ×12


# --- Energizing Cheer S: energía a un compañero al azar -----------------------


def test_skill_random_energy_none_when_not_energizing_cheer() -> None:
    assert daily_production(_species(), _INGREDIENTS, level=60).skill_random_energy is None


def test_energizing_cheer_total_is_triggers_times_amount() -> None:
    species = _species(main_skill="Energizing Cheer S", specialty=Specialty.SKILLS)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=6)
    assert prod.skill_random_energy == pytest.approx(prod.skill_triggers * 50)  # nivel 6
    # No es energía al equipo entero (E4E) ni al usuario (Charge Energy).
    assert prod.skill_energy is None
    assert prod.skill_self_energy is None


# --- Plusle / Minun: tablas propias + bonus de sinergia (condición siempre dada) ---


def test_magnet_plus_total_is_base_only_bonus_in_skill_ingredients() -> None:
    # _species se llama "Tester": el total al azar usa la base (18 a nivel 7) y, al no
    # ser una especie conocida, no se le asigna ingrediente de bonus.
    species = _species(main_skill="Ingredient Magnet S (Plus)", specialty=Specialty.SKILLS)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    assert prod.skill_ingredient_total == pytest.approx(prod.skill_triggers * 18)
    assert prod.skill_ingredients == ()  # sin especie conocida, no hay bonus


def test_magnet_plus_bonus_ingredient_goes_to_skill_ingredients() -> None:
    # Especie conocida (Plusle): el bonus específico (café) va a skill_ingredients,
    # que es lo que el front muestra en la sección Ingredientes.
    plusle = Species(
        "Plusle", 311, Specialty.SKILLS, Berry.GREPA, SleepType.SNOOZING,
        "Ingredient Magnet S (Plus)",
        (I.ROUSING_COFFEE, I.LARGE_LEEK, I.MOOMOO_MILK),
        3200, 23.9, 6.4, ((1,), (2, 1), (4, 2, 3)), 17, 0, 0,
    )
    prod = daily_production(
        plusle, (I.ROUSING_COFFEE, I.LARGE_LEEK, I.MOOMOO_MILK), level=60, skill_level=7
    )
    assert prod.skill_ingredient_total == pytest.approx(prod.skill_triggers * 18)
    assert len(prod.skill_ingredients) == 1
    bonus = prod.skill_ingredients[0]
    assert bonus.ingredient is I.ROUSING_COFFEE
    assert bonus.amount == pytest.approx(prod.skill_triggers * 12)


def test_cooking_minus_pot_and_random_energy() -> None:
    species = _species(main_skill="Cooking Power-Up S (Minus)", specialty=Specialty.SKILLS)
    prod = daily_production(species, _INGREDIENTS, level=60, skill_level=7)
    # Pote con la tabla propia (24 a nivel 7), no la regular.
    assert prod.skill_cooking_ingredients == pytest.approx(prod.skill_triggers * 24)
    # Bonus: energía a un compañero al azar (35 a nivel 7).
    assert prod.skill_random_energy == pytest.approx(prod.skill_triggers * 35)


def test_good_camp_ticket_speeds_up_helps() -> None:
    # El intervalo se multiplica por 0.8 antes del floor → menos segundos por ayuda.
    without = daily_production(
        _species(help_frequency_seconds=3600), _INGREDIENTS, level=1
    )
    with_gct = daily_production(
        _species(help_frequency_seconds=3600), _INGREDIENTS, level=1,
        good_camp_ticket=True,
    )
    assert with_gct.seconds_per_help == math.floor(without.seconds_per_help * 0.8)
    assert with_gct.helps_per_day > without.helps_per_day


def test_good_camp_ticket_raises_inventory_by_20_percent_rounded() -> None:
    # round(62 * 1.2) = round(74.4) = 74.
    prod = daily_production(
        _species(base_inventory=62), _INGREDIENTS, level=60,
        good_camp_ticket=True,
    )
    assert prod.inventory == 74


def test_good_camp_ticket_inventory_applies_over_total() -> None:
    # El ×1.2 va sobre el total (base + Inventory Up + evoluciones), no solo la base.
    # base 11 + INVENTORY_UP_M(12) + INVENTORY_UP_S(6) = 29 → round(29 * 1.2) = round(34.8) = 35.
    prod = daily_production(
        _species(base_inventory=11), _INGREDIENTS, level=60,
        sub_skills=(SubSkill.INVENTORY_UP_M, SubSkill.INVENTORY_UP_S),
        good_camp_ticket=True,
    )
    assert prod.inventory == 35


def test_no_good_camp_ticket_leaves_values_unchanged() -> None:
    # Sin GCT (default) los valores son idénticos al cálculo actual.
    default = daily_production(_species(base_inventory=50), _INGREDIENTS, level=30)
    explicit_off = daily_production(
        _species(base_inventory=50), _INGREDIENTS, level=30,
        good_camp_ticket=False,
    )
    assert default.seconds_per_help == explicit_off.seconds_per_help
    assert default.inventory == explicit_off.inventory == 50
