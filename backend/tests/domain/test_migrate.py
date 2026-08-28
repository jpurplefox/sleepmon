from pathlib import Path

import pytest

from sleepmon.adapters.outbound.postgres import migrate


def test_run_fails_when_no_migrations_are_found(monkeypatch, tmp_path: Path) -> None:
    # yoyo devuelve una lista vacía sin fallar cuando el directorio no existe o
    # está vacío, así que un paquete instalado sin los .sql migraba "con éxito"
    # contra una base vacía. El DSN apunta a un puerto muerto a propósito: si la
    # comprobación se hiciera después de conectar, el error sería de psycopg.
    monkeypatch.setattr(migrate, "MIGRATIONS_DIR", tmp_path)
    with pytest.raises(RuntimeError, match="No migrations found"):
        migrate.run("postgresql://nobody@127.0.0.1:1/nothing")


def test_packaged_migrations_directory_is_not_empty() -> None:
    assert sorted(p.name for p in migrate.MIGRATIONS_DIR.glob("*.sql"))
