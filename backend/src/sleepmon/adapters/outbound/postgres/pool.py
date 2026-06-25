"""Pool de conexiones psycopg."""

from __future__ import annotations

from psycopg_pool import ConnectionPool


def create_pool(dsn: str, *, open_now: bool = True) -> ConnectionPool:
    """Crea (y por defecto abre) un pool de conexiones contra ``dsn``."""
    pool = ConnectionPool(conninfo=dsn, open=False)
    if open_now:
        pool.open()
    return pool
