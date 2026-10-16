"""Dev-only demo backend for the landing captures: the real app on in-memory fakes.

Run from backend/: PYTHONPATH=. python scripts/landing_demo_server.py  (port 8010)
"""

from datetime import UTC, datetime, timedelta

import uvicorn

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.application.auth_service import DefaultAuthService
from sleepmon.application.progress_service import DefaultPlayerProgressService
from sleepmon.application.saved_team_service import DefaultSavedTeamService
from sleepmon.application.services import DefaultProductionService, DefaultTeamService
from sleepmon.domain.auth import ExternalIdentity
from tests.fakes import (
    InMemoryPlayerProgressRepository,
    InMemoryRefreshTokenRepository,
    InMemorySavedTeamRepository,
    InMemoryTeamRepository,
    InMemoryUserRepository,
    StubIdentityProvider,
)

PORT = 8010


def build_app():  # type: ignore[no-untyped-def]
    access = JwtAccessTokenService("landing-demo", timedelta(hours=8))
    progress = InMemoryPlayerProgressRepository()
    team = InMemoryTeamRepository()
    saved = InMemorySavedTeamRepository()
    catalog, recipes = StaticSpeciesCatalog(), StaticRecipeCatalog()
    identity = ExternalIdentity(
        subject="demo", email="ash@example.com", display_name="Ash Ketchum", avatar_url=None
    )
    return create_app(
        service=DefaultTeamService(team, catalog, progress, saved),
        production_service=DefaultProductionService(catalog, recipes),
        catalog=catalog,
        recipe_catalog=recipes,
        access=access,
        auth_service=DefaultAuthService(
            identity=StubIdentityProvider(identity),
            users=InMemoryUserRepository(),
            tokens=InMemoryRefreshTokenRepository(),
            access=access,
            refresh=SecretsRefreshTokenCodec(),
            clock=lambda: datetime.now(UTC),
            refresh_ttl=timedelta(days=30),
        ),
        progress_service=DefaultPlayerProgressService(progress, recipes),
        saved_team_service=DefaultSavedTeamService(
            saved, team, recipes, clock=lambda: datetime.now(UTC)
        ),
    )


if __name__ == "__main__":
    uvicorn.run(build_app(), host="127.0.0.1", port=PORT, log_level="warning")
