"""Estimación de "Extra Tasty" (plato riquísimo / crítico al cocinar) del equipo.

Función pura, sin infraestructura. Modela la mecánica real como una **cadena de
Markov sobre los 21 platos de la semana** (3 comidas × 7 días) y devuelve dos
métricas agregadas del equipo:

- ``rate``: probabilidad promedio de que un plato salga Extra Tasty.
- ``multiplier``: multiplicador de cocina esperado por plato.

Mecánica del juego
------------------
Cada plato sale Extra Tasty con probabilidad ``base + stack``:

- **Entre semana** (6 días): base ``10%``, tope de chance ``80%``, un crítico
  multiplica la receta ``×2``.
- **Domingo** (7º día): base ``30%``, tope ``100%``, multiplicador ``×3``.

El ``stack`` es un bonus acumulado que sube con cada disparo de la main skill
Tasty Chance S y **se resetea a 0 cuando ocurre un crítico**. El stack acumulable
topa en ``70`` puntos porcentuales (dando ``80%`` entre semana y ``100%`` el
domingo). El stack se comparte a nivel EQUIPO: los disparos de todos los miembros
con Tasty Chance alimentan un único stack.

La semana arranca con el stack en 0 el lunes al desayuno (el primer plato no lleva
boost), replicando a RaenonX.

Modelo de disparos (decisión de dominio)
----------------------------------------
Los disparos del día se reparten **uniforme entre los 3 platos** y se modelan como
**Poisson**: en el intervalo previo a cada plato (salvo el primero de la semana)
llegan ``Poisson(disparos_día / 3)`` procs por cada fuente, cada uno de su tamaño.
No se pondera por los horarios reales (9/12/18): concentrar procs en un intervalo
rinde menos (el crítico resetea el exceso) y se aleja de RaenonX; el reparto
parejo es la referencia validada. La granularidad importa: el total diario solo no
alcanza, hacen falta el tamaño y la cantidad de cada proc.

Validación contra RaenonX: sin fuentes → ``12.86% / 1.171x``; una fuente de
``10 pp × 5.66`` disparos → RaenonX ``42.93% / 1.514x``, este modelo ``~42.3% /
1.507x`` (a ~0.6 pt).
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

_MEALS_PER_DAY = 3
_MEALS_PER_WEEK = 21
_SUNDAY_INDEX = 6  # día 0..6; el domingo es el 7º

# Parámetros por régimen: (base_pp, tope_de_chance_pp, multiplicador_de_crítico).
_WEEKDAY = (10, 80, 2.0)
_SUNDAY = (30, 100, 3.0)

# El stack acumulable topa en 70 pp en ambos regímenes (80−10 = 100−30). El grid del
# stack va de 0 a 70 pp con resolución de 1 pp.
_STACK_CAP_PP = 70
_GRID = _STACK_CAP_PP + 1  # estados 0..70

# Truncado del Poisson: probabilidad de más de este nº de procs por intervalo es
# despreciable (con 70 pp de tope y procs de ≥1 pp, 128 procs ya saturan de sobra).
_POISSON_TRUNC = 128


@dataclass(frozen=True, slots=True)
class ExtraTastyEstimate:
    """Estimación agregada de Extra Tasty para el equipo.

    ``rate`` es una probabilidad (0..1); ``multiplier`` es un factor (≥1).
    """

    rate: float
    multiplier: float


def _params(meal_index: int) -> tuple[int, int, float]:
    """(base_pp, tope_pp, multiplicador) del plato según su día de la semana."""
    day = meal_index // _MEALS_PER_DAY
    return _SUNDAY if day == _SUNDAY_INDEX else _WEEKDAY


def _interval_increment(sources: Sequence[tuple[float, float]]) -> list[float]:
    """Distribución del incremento de stack (en pp) en un intervalo entre platos.

    Cada fuente ``(disparos_día, tamaño_pp)`` aporta ``Poisson(disparos_día/3)``
    procs de su tamaño; se convolucionan todas. El resultado ``inc[d]`` es la
    probabilidad de que el stack suba ``d`` pp en el intervalo (acotado al tope).
    """
    inc = [0.0] * _GRID
    inc[0] = 1.0  # sin fuentes, el incremento es 0 con probabilidad 1
    for procs_per_day, size_pp in sources:
        lam = procs_per_day / _MEALS_PER_DAY
        step = int(round(size_pp))
        if lam <= 0 or step <= 0:
            continue
        # Distribución del aporte de esta fuente: k procs (Poisson) suman k·step pp.
        source_inc = [0.0] * _GRID
        pmf = math.exp(-lam)  # P(N = 0)
        for k in range(_POISSON_TRUNC + 1):
            source_inc[min(k * step, _STACK_CAP_PP)] += pmf
            pmf = pmf * lam / (k + 1)
        inc = _convolve_capped(inc, source_inc)
    return inc


def _convolve_capped(a: list[float], b: list[float]) -> list[float]:
    """Convolución de dos distribuciones sobre pp, acumulando todo lo que exceda el
    tope en el estado tope (el stack no puede pasar de ``_STACK_CAP_PP``)."""
    out = [0.0] * _GRID
    for i, pa in enumerate(a):
        if pa == 0.0:
            continue
        for j, pb in enumerate(b):
            if pb == 0.0:
                continue
            out[min(i + j, _STACK_CAP_PP)] += pa * pb
    return out


def expected_extra_tasty(
    sources: Sequence[tuple[float, float]],
) -> ExtraTastyEstimate:
    """Chance y multiplicador esperados de Extra Tasty del equipo.

    ``sources`` es una secuencia de ``(disparos_día, tamaño_pp)``, una por miembro
    con Tasty Chance S. Vacía → solo la base del juego (12.86% / 1.171x).
    """
    increment = _interval_increment(sources)

    # Distribución del stack (pp) al entrar a cada plato. Arranca en 0 (lunes desayuno).
    stack = [0.0] * _GRID
    stack[0] = 1.0

    rate_sum = 0.0
    mult_sum = 0.0
    for meal in range(_MEALS_PER_WEEK):
        if meal > 0:
            stack = _convolve_capped(stack, increment)
        base, cap, mult = _params(meal)

        after = [0.0] * _GRID
        for s, prob in enumerate(stack):
            if prob == 0.0:
                continue
            p = min(base + s, cap) / 100.0
            rate_sum += prob * p
            mult_sum += prob * (1.0 + p * (mult - 1.0))
            after[0] += prob * p  # crítico → stack resetea a 0
            after[s] += prob * (1.0 - p)  # sin crítico → stack se mantiene
        stack = after

    return ExtraTastyEstimate(
        rate=rate_sum / _MEALS_PER_WEEK,
        multiplier=mult_sum / _MEALS_PER_WEEK,
    )
