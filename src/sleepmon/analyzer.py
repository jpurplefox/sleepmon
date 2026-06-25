"""Análisis mínimo de sesiones de sueño.

Código deliberadamente simple: es el "sustrato" sobre el que vas a practicar
loop engineering (workflows, subagentes, /loop). Tiene la suficiente lógica
como para que valga la pena auditarlo, refactorizarlo o ampliarlo en bucle.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SleepSession:
    """Una noche de sueño.

    Attributes:
        date: Fecha en formato ISO (YYYY-MM-DD).
        time_in_bed_min: Minutos totales en la cama.
        asleep_min: Minutos efectivamente dormido.
        awakenings: Cantidad de despertares.
    """

    date: str
    time_in_bed_min: int
    asleep_min: int
    awakenings: int


def sleep_efficiency(session: SleepSession) -> float:
    """Eficiencia del sueño: % del tiempo en cama que se pasó dormido."""
    if session.time_in_bed_min <= 0:
        return 0.0
    return round(100 * session.asleep_min / session.time_in_bed_min, 1)


def summarize(sessions: list[SleepSession]) -> dict[str, float]:
    """Resumen agregado de una lista de sesiones."""
    if not sessions:
        return {"nights": 0, "avg_asleep_min": 0.0, "avg_efficiency": 0.0}
    n = len(sessions)
    return {
        "nights": n,
        "avg_asleep_min": round(sum(s.asleep_min for s in sessions) / n, 1),
        "avg_efficiency": round(sum(sleep_efficiency(s) for s in sessions) / n, 1),
    }
