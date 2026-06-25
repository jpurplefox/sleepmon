"""Runner de migración mínimo: aplica ``schema.sql`` contra la base.

Uso: ``python -m sleepmon.adapters.outbound.postgres.migrate``
"""

from __future__ import annotations

from pathlib import Path

import psycopg

from sleepmon.config import Settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def run(dsn: str) -> None:
    """Ejecuta el schema (idempotente: usa ``CREATE TABLE IF NOT EXISTS``)."""
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with psycopg.connect(dsn) as conn:
        conn.execute(sql)


def main() -> None:
    settings = Settings.from_env()
    run(settings.database_url)
    print(f"Schema aplicado en {settings.database_url}")


if __name__ == "__main__":
    main()
