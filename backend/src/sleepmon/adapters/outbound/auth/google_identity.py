from __future__ import annotations

from collections.abc import Callable
from typing import Any, cast

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from sleepmon.domain.auth import ExternalIdentity, InvalidCredentialError
from sleepmon.domain.ports import IdentityProvider

Verifier = Callable[[str, Any, str], dict[str, Any]]


def _google_verifier(credential: str, request: Any, client_id: str) -> dict[str, Any]:
    return cast(dict[str, Any], id_token.verify_oauth2_token(credential, request, client_id))  # type: ignore[no-untyped-call]


class GoogleIdentityProvider(IdentityProvider):
    def __init__(self, client_id: str, verifier: Verifier = _google_verifier) -> None:
        self._client_id = client_id
        self._verifier = verifier
        self._request = google_requests.Request()

    def verify(self, credential: str) -> ExternalIdentity:
        try:
            claims = self._verifier(credential, self._request, self._client_id)
        except Exception as exc:  # google-auth raises ValueError/GoogleAuthError
            raise InvalidCredentialError(str(exc)) from exc
        return ExternalIdentity(
            subject=str(claims["sub"]),
            email=str(claims.get("email", "")),
            display_name=str(claims.get("name", claims.get("email", ""))),
            avatar_url=claims.get("picture"),
        )
