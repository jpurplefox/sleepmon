"""Regresión de seguridad: el stack real no debe poder arrancar con secretos vacíos.

``Settings.from_env()`` defaultea ``jwt_secret``/``google_client_id`` a ``""`` cuando
las variables de entorno no están seteadas. Si ``create_app`` construyera el stack
real (sin inyectar ``service``/``access``/``auth_service``) con esos defaults, los
tokens de acceso quedarían firmados/verificados bajo la clave ``""`` — falsificación
trivial y bypass total de autenticación. Estos tests no tocan Postgres: la validación
de secretos corre antes de cualquier ``create_pool(...)``.
"""

from __future__ import annotations

from datetime import timedelta

import pytest

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.auth_service import AuthResult, AuthService
from sleepmon.application.services import DefaultTeamService
from sleepmon.config import Settings
from tests.fakes import InMemoryTeamRepository


def _settings(*, jwt_secret: str = "s3cr3t", google_client_id: str = "cid") -> Settings:
    return Settings(
        database_url="postgresql://unused:unused@localhost:5432/unused",
        google_client_id=google_client_id,
        jwt_secret=jwt_secret,
        access_ttl=timedelta(minutes=15),
        refresh_ttl=timedelta(days=30),
        cookie_secure=True,
    )


class _FakeAuth(AuthService):
    def login_with_google(self, credential: str) -> AuthResult:
        raise NotImplementedError

    def refresh(self, refresh_token: str) -> AuthResult:
        raise NotImplementedError

    def logout(self, refresh_token: str) -> None:
        raise NotImplementedError


def test_create_app_raises_on_empty_jwt_secret() -> None:
    # No service/access/auth_service injected -> create_app tries to build the
    # REAL stack from these settings. Must fail before ever calling create_pool
    # (there is no reachable Postgres in this environment).
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        create_app(settings=_settings(jwt_secret=""))


def test_create_app_raises_on_empty_google_client_id() -> None:
    with pytest.raises(RuntimeError, match="GOOGLE_CLIENT_ID"):
        create_app(settings=_settings(google_client_id=""))


def test_create_app_does_not_raise_when_secrets_are_injected() -> None:
    # Injecting service/access/auth_service means create_app never reads
    # Settings.from_env() for the real stack, so an empty/absent settings object
    # must not trigger the fail-fast guard. Covered already by the fixtures in
    # tests/http/test_api.py and tests/http/test_auth_api.py; this test pins the
    # contract explicitly for the guard added in this change.
    app = create_app(
        service=DefaultTeamService(
            InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
        ),
        catalog=StaticSpeciesCatalog(),
        recipe_catalog=StaticRecipeCatalog(),
        access=JwtAccessTokenService("test-secret", timedelta(minutes=15)),
        auth_service=_FakeAuth(),
    )
    assert app is not None
