"""Regresión del ciclo de vida del app real (startup/shutdown con pool Postgres).

El hook ``on_shutdown`` cerraba el pool pasándole el app de Litestar como argumento
(`pool.close(app)` -> `timeout=app`), reventando el shutdown. Este test construye el
app real y corre su lifespan completo vía ``TestClient`` —como Litestar en prod— y
falla si el shutdown no cierra limpio. Requiere Postgres (marcado ``integration``).
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from litestar.testing import TestClient

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.config import Settings

pytestmark = pytest.mark.integration


def test_app_lifespan_closes_pool_cleanly(test_dsn: str) -> None:
    # Base de test dedicada, nunca la de desarrollo. El stack real exige secretos
    # de auth no vacíos (fail-fast), así que pasamos placeholders válidos; este
    # test solo ejercita startup/shutdown y una ruta abierta (/catalog).
    app = create_app(
        settings=Settings(
            database_url=test_dsn,
            google_client_id="test-client-id",
            jwt_secret="test-jwt-secret-at-least-32-bytes-long",
            access_ttl=timedelta(minutes=15),
            refresh_ttl=timedelta(days=30),
            cookie_secure=False,
            cors_origins=("http://localhost:5173",),
            cookie_samesite="strict",
        )
    )
    # El context manager del TestClient corre on_startup y on_shutdown.
    with TestClient(app=app) as client:
        assert client.get("/catalog").status_code == 200
    # Salir del bloque sin excepción confirma que on_shutdown (pool.close) corrió bien.
