"""HTTP edge for authentication: Google login, refresh rotation, logout.

Depends on the ``AuthService`` primary port (DI), never on a concrete adapter.
The refresh token travels ONLY as an ``HttpOnly`` cookie scoped to ``/auth``
(so it reaches ``/auth/refresh`` and ``/auth/logout``) — it is never present
in a JSON response body.
"""

from __future__ import annotations

from typing import Any

from litestar import Controller, Request, Response, post
from litestar.datastructures import Cookie
from litestar.di import NamedDependency
from litestar.status_codes import HTTP_200_OK, HTTP_204_NO_CONTENT

from sleepmon.adapters.inbound.http.schemas import AuthOut, GoogleLoginIn, UserOut
from sleepmon.application.auth_service import AuthResult, AuthService
from sleepmon.config import SameSite
from sleepmon.domain.auth import InvalidRefreshError

REFRESH_COOKIE = "refresh_token"
# Scoped to the whole /auth prefix (not just /auth/refresh) so the browser also
# sends the cookie on POST /auth/logout — otherwise logout can never revoke the
# refresh-token family server-side and it stays valid until it expires.
REFRESH_PATH = "/auth"


def _user_out(result: AuthResult) -> UserOut:
    return UserOut(
        id=result.user.id,
        email=result.user.email,
        display_name=result.user.display_name,
        avatar_url=result.user.avatar_url,
    )


class AuthController(Controller):
    path = "/auth"

    def _with_refresh_cookie(
        self, result: AuthResult, *, secure: bool, samesite: SameSite, max_age: int
    ) -> Response[AuthOut]:
        cookie = Cookie(
            key=REFRESH_COOKIE,
            value=result.refresh_token,
            path=REFRESH_PATH,
            httponly=True,
            secure=secure,
            samesite=samesite,
            max_age=max_age,
        )
        return Response(
            AuthOut(access_token=result.access_token, user=_user_out(result)),
            status_code=HTTP_200_OK,
            cookies=[cookie],
        )

    @post("/google", sync_to_thread=True)
    def google(
        self,
        auth_service: NamedDependency[AuthService],
        request: Request[Any, Any, Any],
        data: GoogleLoginIn,
    ) -> Response[AuthOut]:
        result = auth_service.login_with_google(data.credential)
        cookie_secure: bool = request.app.state.cookie_secure
        cookie_samesite: SameSite = request.app.state.cookie_samesite
        refresh_max_age: int = request.app.state.refresh_max_age
        return self._with_refresh_cookie(
            result, secure=cookie_secure, samesite=cookie_samesite, max_age=refresh_max_age
        )

    @post("/refresh", sync_to_thread=True)
    def refresh(
        self, auth_service: NamedDependency[AuthService], request: Request[Any, Any, Any]
    ) -> Response[AuthOut]:
        token = request.cookies.get(REFRESH_COOKIE)
        if not token:
            raise InvalidRefreshError("no refresh cookie")
        result = auth_service.refresh(token)
        cookie_secure: bool = request.app.state.cookie_secure
        cookie_samesite: SameSite = request.app.state.cookie_samesite
        refresh_max_age: int = request.app.state.refresh_max_age
        return self._with_refresh_cookie(
            result, secure=cookie_secure, samesite=cookie_samesite, max_age=refresh_max_age
        )

    @post("/logout", status_code=HTTP_204_NO_CONTENT, sync_to_thread=True)
    def logout(
        self, auth_service: NamedDependency[AuthService], request: Request[Any, Any, Any]
    ) -> Response[None]:
        token = request.cookies.get(REFRESH_COOKIE)
        if token:
            auth_service.logout(token)
        cookie_secure: bool = request.app.state.cookie_secure
        cookie_samesite: SameSite = request.app.state.cookie_samesite
        cleared = Cookie(
            key=REFRESH_COOKIE,
            value="",
            path=REFRESH_PATH,
            httponly=True,
            secure=cookie_secure,
            samesite=cookie_samesite,
            max_age=0,
        )
        return Response(None, status_code=HTTP_204_NO_CONTENT, cookies=[cleared])
