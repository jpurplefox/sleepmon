from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from sleepmon.domain.auth import InvalidTokenError
from sleepmon.domain.ports import AccessTokenService


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)  # noqa: UP017 (support Python 3.11)


class JwtAccessTokenService(AccessTokenService):
    def __init__(
        self, secret: str, ttl: timedelta, clock: Callable[[], datetime] = _utcnow
    ) -> None:
        self._secret = secret
        self._ttl = ttl
        self._clock = clock

    def issue(self, user_id: UUID) -> str:
        now = self._clock()
        payload = {"sub": str(user_id), "iat": int(now.timestamp()),
                   "exp": int((now + self._ttl).timestamp())}
        return jwt.encode(payload, self._secret, algorithm="HS256")

    def verify(self, token: str) -> UUID:
        try:
            payload = jwt.decode(token, self._secret, algorithms=["HS256"])
            return UUID(payload["sub"])
        except (jwt.InvalidTokenError, KeyError, ValueError) as exc:
            raise InvalidTokenError(str(exc)) from exc
