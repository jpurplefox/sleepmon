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

from sleepmon.adapters.inbound.http.observability import tag_request_user
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
    user_id = access.verify(_bearer(request))
    tag_request_user(user_id)
    return user_id


def optional_user_id(request: Request[Any, Any, Any]) -> UUID | None:
    """The signed-in user, or None without an Authorization header.

    A header that is present but invalid still answers 401 (via ``current_user_id``),
    so a stale session refreshes instead of silently sharing signed out.
    """
    if "Authorization" not in request.headers:
        return None
    return current_user_id(request)
