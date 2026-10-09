"""Pool de conexiones psycopg."""

from __future__ import annotations

from psycopg_pool import ConnectionPool

# psycopg_pool's own default: enough for a threaded server handling requests in parallel.
DEFAULT_POOL_SIZE = 4


def create_pool(
    dsn: str, *, size: int = DEFAULT_POOL_SIZE, open_now: bool = True
) -> ConnectionPool:
    """Crea (y por defecto abre) un pool de ``size`` conexiones fijas contra ``dsn``."""
    pool = ConnectionPool(conninfo=dsn, min_size=size, max_size=size, open=False)
    if open_now:
        pool.open()
    return pool
