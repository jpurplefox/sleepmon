"""Guard HTTP + dependencia de identidad: exigen y resuelven el usuario autenticado.

Vive en el adapter HTTP (no en el dominio): traduce el header ``Authorization`` a un
``UUID`` de usuario usando el puerto ``AccessTokenService``, y convierte tokens
ausentes/ inválidos en un 401 de Litestar.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from litestar import Request
from litestar.connection import ASGIConnection
from litestar.exceptions import NotAuthorizedException
from litestar.handlers.base import BaseRouteHandler

from sleepmon.domain.auth import InvalidTokenError
from sleepmon.domain.ports import AccessTokenService


def _bearer(connection: ASGIConnection[Any, Any, Any, Any]) -> str:
    header = connection.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise NotAuthorizedException("Missing bearer token")
    return header[len("Bearer ") :]


def require_user(connection: ASGIConnection[Any, Any, Any, Any], _: BaseRouteHandler) -> None:
    access: AccessTokenService = connection.app.state.access
    try:
        access.verify(_bearer(connection))
    except InvalidTokenError as exc:
        raise NotAuthorizedException("Invalid or expired token") from exc


def current_user_id(request: Request[Any, Any, Any]) -> UUID:
    access: AccessTokenService = request.app.state.access
    return access.verify(_bearer(request))
