"""Composition root: arma la app Litestar cableando adapters → servicios → HTTP.

``create_app`` es una *factory*. Sin argumentos construye el stack real (pool
Postgres + catálogo estático). En tests se le inyecta un ``service`` y un
``catalog`` fake para correr sin base.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from litestar import Litestar, Request, Response
from litestar.config.cors import CORSConfig
from litestar.datastructures import State
from litestar.di import Provide
from litestar.status_codes import HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND
from psycopg_pool import ConnectionPool

from sleepmon.adapters.inbound.http.auth_controller import AuthController
from sleepmon.adapters.inbound.http.controllers import (
    CatalogController,
    ProductionController,
    RecipeController,
    TeamController,
    TeamProductionController,
)
from sleepmon.adapters.inbound.http.guards import current_user_id
from sleepmon.adapters.inbound.http.schemas import ErrorOut
from sleepmon.adapters.outbound.auth.google_identity import GoogleIdentityProvider
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresRefreshTokenRepository,
    PostgresTeamRepository,
    PostgresUserRepository,
)
from sleepmon.application.auth_service import AuthService, DefaultAuthService
from sleepmon.application.services import DefaultTeamService, TeamService
from sleepmon.config import Settings
from sleepmon.domain.auth import InvalidCredentialError, InvalidRefreshError, InvalidTokenError
from sleepmon.domain.errors import TeamMemberNotFoundError, ValidationError
from sleepmon.domain.ports import AccessTokenService, RecipeCatalog, SpeciesCatalog


def _validation_handler(_: Request[Any, Any, Any], exc: ValidationError) -> Response[ErrorOut]:
    return Response(ErrorOut(detail=str(exc)), status_code=HTTP_400_BAD_REQUEST)


def _not_found_handler(
    _: Request[Any, Any, Any], exc: TeamMemberNotFoundError
) -> Response[ErrorOut]:
    return Response(ErrorOut(detail=f"No existe el miembro {exc}."), status_code=HTTP_404_NOT_FOUND)


def _unauthorized_handler(_: Request[Any, Any, Any], exc: Exception) -> Response[ErrorOut]:
    return Response(
        ErrorOut(detail=str(exc) or "No autenticado."), status_code=HTTP_401_UNAUTHORIZED
    )


def create_app(
    *,
    service: TeamService | None = None,
    catalog: SpeciesCatalog | None = None,
    recipe_catalog: RecipeCatalog | None = None,
    settings: Settings | None = None,
    access: AccessTokenService | None = None,
    auth_service: AuthService | None = None,
) -> Litestar:
    # ``object`` y no ``Any``: el valor de retorno de los hooks se descarta, pero
    # ``Any`` apagaría el chequeo de tipos sobre el cuerpo de cada callback.
    on_shutdown: list[Callable[[], object]] = []
    pool: ConnectionPool | None = None

    if catalog is None:
        catalog = StaticSpeciesCatalog()
    if recipe_catalog is None:
        recipe_catalog = StaticRecipeCatalog()

    # Fail fast, before opening any DB connection, if we are about to build any
    # part of the REAL stack (service/access/auth_service not injected) and the
    # secrets it depends on are missing. An empty jwt_secret would sign/verify
    # access tokens under "" — trivial forgery and a full auth bypass — and an
    # empty google_client_id would accept Google ID tokens without pinning an
    # audience. Test injection paths (service/access/auth_service all provided)
    # never read Settings.from_env() and so never hit this check.
    if service is None or access is None or auth_service is None:
        settings = settings or Settings.from_env()
        if not settings.jwt_secret:
            raise RuntimeError("JWT_SECRET must be set")
        if not settings.google_client_id:
            raise RuntimeError("GOOGLE_CLIENT_ID must be set")

    if service is None:
        settings = settings or Settings.from_env()
        team_pool = create_pool(settings.database_url)
        pool = team_pool
        repository = PostgresTeamRepository(team_pool)
        service = DefaultTeamService(repository, catalog, recipe_catalog)
        # Litestar pasa el app a los hooks que aceptan un argumento; sin el lambda,
        # `pool.close` recibiría el app como su parámetro `timeout` y reventaría.
        # ``team_pool`` (a diferencia de ``pool``) tiene un único sitio de asignación,
        # así que mypy lo tipa como ``ConnectionPool`` (no ``| None``) dentro del closure.
        on_shutdown.append(lambda: team_pool.close())

    if access is None:
        settings = settings or Settings.from_env()
        access = JwtAccessTokenService(settings.jwt_secret, settings.access_ttl)

    if auth_service is None:
        settings = settings or Settings.from_env()
        # Reutiliza el pool del team repository si ya existe; si no, abre uno solo
        # (nunca dos pools contra la misma base).
        if pool is None:
            auth_pool = create_pool(settings.database_url)
            pool = auth_pool
            on_shutdown.append(lambda: auth_pool.close())
        else:
            auth_pool = pool
        auth_service = DefaultAuthService(
            identity=GoogleIdentityProvider(settings.google_client_id),
            users=PostgresUserRepository(auth_pool),
            tokens=PostgresRefreshTokenRepository(auth_pool),
            access=access,
            refresh=SecretsRefreshTokenCodec(),
            clock=lambda: datetime.now(UTC),
            refresh_ttl=settings.refresh_ttl,
        )

    # Singletons inyectados por DI (sync_to_thread=False: solo devuelven la instancia).
    bound_service = service
    bound_catalog = catalog
    bound_auth_service = auth_service

    cookie_secure = settings.cookie_secure if settings is not None else True
    cookie_samesite = settings.cookie_samesite if settings is not None else "strict"
    cors_origins = (
        list(settings.cors_origins)
        if settings is not None
        else ["http://localhost:5173", "http://localhost:3000"]
    )
    refresh_max_age = int(
        (settings.refresh_ttl if settings is not None else timedelta(days=30)).total_seconds()
    )

    return Litestar(
        route_handlers=[
            TeamController,
            CatalogController,
            ProductionController,
            RecipeController,
            TeamProductionController,
            AuthController,
        ],
        state=State(
            {
                "access": access,
                "cookie_secure": cookie_secure,
                "cookie_samesite": cookie_samesite,
                "refresh_max_age": refresh_max_age,
            }
        ),
        dependencies={
            "service": Provide(lambda: bound_service, sync_to_thread=False),
            "catalog": Provide(lambda: bound_catalog, sync_to_thread=False),
            "current_user_id": Provide(current_user_id, sync_to_thread=False),
            "auth_service": Provide(lambda: bound_auth_service, sync_to_thread=False),
        },
        exception_handlers={
            ValidationError: _validation_handler,
            TeamMemberNotFoundError: _not_found_handler,
            InvalidCredentialError: _unauthorized_handler,
            InvalidTokenError: _unauthorized_handler,
            InvalidRefreshError: _unauthorized_handler,
        },
        cors_config=CORSConfig(
            allow_origins=cors_origins,
            allow_credentials=True,
        ),
        on_shutdown=on_shutdown,
    )
