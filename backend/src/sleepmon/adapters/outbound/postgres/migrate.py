"""yoyo migration runner: applies the versioned migrations in ``migrations/``.

yoyo keeps the applied-migration history in its own table (``_yoyo_migration``)
and applies only the pending ones, so it is safe to run on every boot.

Usage: ``python -m sleepmon.adapters.outbound.postgres.migrate``
"""

from __future__ import annotations

from pathlib import Path

from yoyo import get_backend, read_migrations

from sleepmon.config import Settings

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def _yoyo_uri(dsn: str) -> str:
    """yoyo picks the driver from the DSN scheme; force psycopg3 (psycopg2 is absent)."""
    for prefix in ("postgresql://", "postgres://"):
        if dsn.startswith(prefix):
            return "postgresql+psycopg://" + dsn[len(prefix) :]
    return dsn


def run(dsn: str) -> None:
    """Apply the pending migrations against ``dsn``."""
    backend = get_backend(_yoyo_uri(dsn))
    migrations = read_migrations(str(MIGRATIONS_DIR))
    with backend.lock():
        backend.apply_migrations(backend.to_apply(migrations))


def main() -> None:
    settings = Settings.from_env()
    run(settings.database_url)
    print(f"Migrations applied to {settings.database_url}")


if __name__ == "__main__":
    main()
