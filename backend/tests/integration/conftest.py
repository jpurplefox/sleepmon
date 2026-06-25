"""Configuración compartida de los tests de integración.

Estos tests **truncan tablas**, así que SIEMPRE corren contra una base dedicada
(`*_test`), nunca contra la de desarrollo. La guardia se niega a operar si el nombre
de la base no termina en `_test`, y la base de test se crea sola si no existe.

Se configura con `TEST_DATABASE_URL` (default: `…/sleepmon_test`).
"""

from __future__ import annotations

import os

import psycopg
import pytest

from sleepmon.adapters.outbound.postgres import migrate

DEFAULT_TEST_DSN = "postgresql://sleepmon:sleepmon@localhost:5432/sleepmon_test"


def _db_name(dsn: str) -> str:
    return dsn.rsplit("/", 1)[-1].split("?")[0]


def _ensure_database(dsn: str) -> None:
    """Crea la base de test si no existe, vía la base de mantenimiento `postgres`."""
    admin_dsn = dsn.rsplit("/", 1)[0] + "/postgres"
    name = _db_name(dsn)
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (name,)).fetchone()
        if exists is None:
            conn.execute(f'CREATE DATABASE "{name}"')


@pytest.fixture(scope="session")
def test_dsn() -> str:
    dsn = os.environ.get("TEST_DATABASE_URL", DEFAULT_TEST_DSN)
    name = _db_name(dsn)
    if not name.endswith("_test"):
        pytest.fail(
            f"Los tests de integración solo corren contra una base '*_test'; "
            f"TEST_DATABASE_URL apunta a {name!r}. Me niego a truncar la base de desarrollo."
        )
    try:
        _ensure_database(dsn)
        migrate.run(dsn)
    except Exception as exc:  # noqa: BLE001 — sin Postgres, los tests no aplican
        pytest.skip(f"Postgres no disponible para tests de integración: {exc}")
    return dsn
