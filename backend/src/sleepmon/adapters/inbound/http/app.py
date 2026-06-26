"""Composition root: arma la app Litestar cableando adapters → servicios → HTTP.

``create_app`` es una *factory*. Sin argumentos construye el stack real (pool
Postgres + catálogo estático). En tests se le inyecta un ``service`` y un
``catalog`` fake para correr sin base.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from litestar import Litestar, Request, Response
from litestar.config.cors import CORSConfig
from litestar.di import Provide
from litestar.status_codes import HTTP_400_BAD_REQUEST, HTTP_404_NOT_FOUND

from sleepmon.adapters.inbound.http.controllers import (
    CatalogController,
    ProductionController,
    TeamController,
)
from sleepmon.adapters.inbound.http.schemas import ErrorOut
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import PostgresTeamRepository
from sleepmon.application.services import DefaultTeamService, TeamService
from sleepmon.config import Settings
from sleepmon.domain.errors import TeamMemberNotFoundError, ValidationError
from sleepmon.domain.ports import SpeciesCatalog


def _validation_handler(_: Request[Any, Any, Any], exc: ValidationError) -> Response[ErrorOut]:
    return Response(ErrorOut(detail=str(exc)), status_code=HTTP_400_BAD_REQUEST)


def _not_found_handler(
    _: Request[Any, Any, Any], exc: TeamMemberNotFoundError
) -> Response[ErrorOut]:
    return Response(ErrorOut(detail=f"No existe el miembro {exc}."), status_code=HTTP_404_NOT_FOUND)


def create_app(
    *,
    service: TeamService | None = None,
    catalog: SpeciesCatalog | None = None,
    settings: Settings | None = None,
) -> Litestar:
    on_shutdown: list[Callable[[], Any]] = []

    if catalog is None:
        catalog = StaticSpeciesCatalog()

    if service is None:
        settings = settings or Settings.from_env()
        pool = create_pool(settings.database_url)
        repository = PostgresTeamRepository(pool)
        service = DefaultTeamService(repository, catalog)
        # Litestar pasa el app a los hooks que aceptan un argumento; sin el lambda,
        # `pool.close` recibiría el app como su parámetro `timeout` y reventaría.
        on_shutdown.append(lambda: pool.close())

    # Singletons inyectados por DI (sync_to_thread=False: solo devuelven la instancia).
    bound_service = service
    bound_catalog = catalog

    return Litestar(
        route_handlers=[TeamController, CatalogController, ProductionController],
        dependencies={
            "service": Provide(lambda: bound_service, sync_to_thread=False),
            "catalog": Provide(lambda: bound_catalog, sync_to_thread=False),
        },
        exception_handlers={
            ValidationError: _validation_handler,
            TeamMemberNotFoundError: _not_found_handler,
        },
        cors_config=CORSConfig(
            allow_origins=["http://localhost:5173", "http://localhost:3000"]
        ),
        on_shutdown=on_shutdown,
    )
