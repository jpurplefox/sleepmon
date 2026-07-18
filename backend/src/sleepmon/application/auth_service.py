"""Authentication use case (primary port + implementation).

Orchestrates Google login, refresh-token rotation, and in-family reuse detection.
Depends only on the ports (``IdentityProvider``, ``UserRepository``,
``RefreshTokenRepository``, ``AccessTokenService``, ``RefreshTokenCodec``), never on
a concrete adapter (DIP).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from sleepmon.domain.auth import (
    InvalidRefreshError,
    RefreshReuseError,
    RefreshToken,
    User,
)
from sleepmon.domain.ports import (
    AccessTokenService,
    IdentityProvider,
    RefreshTokenCodec,
    RefreshTokenRepository,
    UserRepository,
)


@dataclass(frozen=True, slots=True)
class UserDTO:
    id: str
    email: str
    display_name: str
    avatar_url: str | None


@dataclass(frozen=True, slots=True)
class AuthResult:
    access_token: str
    refresh_token: str  # clear; the HTTP layer puts it in the cookie, never the body
    user: UserDTO


def _to_dto(user: User) -> UserDTO:
    return UserDTO(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
    )


class AuthService(ABC):
    """Primary port: what the HTTP edge can ask of authentication."""

    @abstractmethod
    def login_with_google(self, credential: str) -> AuthResult: ...

    @abstractmethod
    def refresh(self, refresh_token: str) -> AuthResult: ...

    @abstractmethod
    def logout(self, refresh_token: str) -> None: ...


class DefaultAuthService(AuthService):
    def __init__(
        self,
        identity: IdentityProvider,
        users: UserRepository,
        tokens: RefreshTokenRepository,
        access: AccessTokenService,
        refresh: RefreshTokenCodec,
        clock: Callable[[], datetime],
        refresh_ttl: timedelta,
        id_factory: Callable[[], UUID] = uuid4,
    ) -> None:
        self._identity = identity
        self._users = users
        self._tokens = tokens
        self._access = access
        self._refresh = refresh
        self._clock = clock
        self._refresh_ttl = refresh_ttl
        self._id = id_factory

    def login_with_google(self, credential: str) -> AuthResult:
        ident = self._identity.verify(credential)
        user = self._users.get_by_google_sub(ident.subject)
        if user is None:
            user = User(
                id=self._id(),
                google_sub=ident.subject,
                email=ident.email,
                display_name=ident.display_name,
                avatar_url=ident.avatar_url,
                created_at=self._clock(),
            )
            self._users.add(user)
        return self._issue(user, family_id=self._id())

    def refresh(self, refresh_token: str) -> AuthResult:
        token_hash = self._refresh.hash(refresh_token)
        record = self._tokens.find_by_hash(token_hash)
        if record is None:
            raise InvalidRefreshError("unknown refresh token")
        if record.expires_at <= self._clock():
            self._tokens.delete_family(record.family_id)
            raise InvalidRefreshError("expired refresh token")
        if record.consumed:
            # Theft signal: a token that was already exchanged for a successor is
            # being replayed. Revoke the whole family, not just this token.
            self._tokens.delete_family(record.family_id)
            raise RefreshReuseError("refresh token reuse detected")
        self._tokens.consume(record.id)
        user = self._users.get(record.user_id)
        if user is None:  # defensive: user vanished
            self._tokens.delete_family(record.family_id)
            raise InvalidRefreshError("user no longer exists")
        return self._issue(user, family_id=record.family_id)

    def logout(self, refresh_token: str) -> None:
        record = self._tokens.find_by_hash(self._refresh.hash(refresh_token))
        if record is not None:
            self._tokens.delete_family(record.family_id)

    def _issue(self, user: User, *, family_id: UUID) -> AuthResult:
        access = self._access.issue(user.id)
        clear, token_hash = self._refresh.generate()
        now = self._clock()
        self._tokens.add(
            RefreshToken(
                id=self._id(),
                family_id=family_id,
                user_id=user.id,
                token_hash=token_hash,
                consumed=False,
                expires_at=now + self._refresh_ttl,
                created_at=now,
            )
        )
        return AuthResult(access_token=access, refresh_token=clear, user=_to_dto(user))
