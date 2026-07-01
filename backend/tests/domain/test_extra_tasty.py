"""Tests del modelo de Extra Tasty (chance de crítico + multiplicador esperado).

Anclas externas de RaenonX (fuente canónica):
- Sin skills de crítico: 12.86% / 1.171x.
- Un proc de 10 pp × 5.66 disparos/día: ~42.9% / 1.514x (RaenonX). Nuestro modelo
  Poisson-uniforme cae a ~0.6 pt (reparte los procs parejo entre los 3 platos).

El baseline es analítico y no depende de la implementación:
- chance = (18·10% + 3·30%) / 21 = 2.7 / 21
- mult   = (18·1.1 + 3·1.6) / 21 = 24.6 / 21   (semana 1+p·1, domingo 1+p·2)
"""

import pytest

from sleepmon.domain.extra_tasty import expected_extra_tasty


def test_baseline_without_skills_matches_game_base_rate() -> None:
    est = expected_extra_tasty([])
    assert est.rate == pytest.approx(2.7 / 21)  # 12.857%
    assert est.multiplier == pytest.approx(24.6 / 21)  # 1.17143x


def test_matches_raenonx_reference_within_tolerance() -> None:
    # RaenonX: 5.66 disparos/día de +10 pp → 42.93% / 1.514x. El reparto uniforme
    # Poisson cae a ~0.6 pt (menos de 1 pt de chance, menos de 0.01 de multiplicador).
    est = expected_extra_tasty([(5.66, 10.0)])
    assert est.rate == pytest.approx(0.4293, abs=0.01)
    assert est.multiplier == pytest.approx(1.514, abs=0.01)


def test_shared_stack_splitting_a_source_gives_same_result() -> None:
    # El stack es del equipo: dos miembros con la mitad de los disparos rinden igual
    # que uno solo con el total (mismos disparos totales, mismo tamaño de proc).
    combined = expected_extra_tasty([(5.66, 10.0)])
    split = expected_extra_tasty([(2.83, 10.0), (2.83, 10.0)])
    assert split.rate == pytest.approx(combined.rate)
    assert split.multiplier == pytest.approx(combined.multiplier)


def test_more_triggers_raise_rate_and_multiplier() -> None:
    low = expected_extra_tasty([(2.0, 10.0)])
    high = expected_extra_tasty([(8.0, 10.0)])
    assert high.rate > low.rate > expected_extra_tasty([]).rate
    assert high.multiplier > low.multiplier


def test_rate_never_exceeds_the_sunday_cap() -> None:
    # Aun con disparos absurdos, el promedio queda muy por debajo del tope (100%): el
    # crítico resetea el stack todo el tiempo.
    est = expected_extra_tasty([(200.0, 10.0)])
    assert est.rate < 1.0
    assert est.multiplier < 3.0


def test_zero_trigger_source_is_ignored() -> None:
    assert expected_extra_tasty([(0.0, 10.0)]).rate == pytest.approx(
        expected_extra_tasty([]).rate
    )
