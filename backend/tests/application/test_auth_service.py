from datetime import UTC, datetime, timedelta

import pytest

from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec
from sleepmon.application.auth_service import DefaultAuthService
from sleepmon.domain.auth import ExternalIdentity, InvalidRefreshError, RefreshReuseError
from sleepmon.domain.ports import IdentityProvider
from tests.fakes import InMemoryRefreshTokenRepository, InMemoryUserRepository


class StubIdentity(IdentityProvider):
    def __init__(self, ident: ExternalIdentity) -> None:
        self._ident = ident

    def verify(self, credential: str) -> ExternalIdentity:
        return self._ident


def _service(
    now: datetime = datetime(2026, 1, 1, tzinfo=UTC),
    ident: ExternalIdentity | None = None,
) -> tuple[DefaultAuthService, InMemoryUserRepository, InMemoryRefreshTokenRepository]:
    identity = StubIdentity(
        ident
        or ExternalIdentity(subject="g-1", email="a@b.com", display_name="Ada", avatar_url=None)
    )
    users = InMemoryUserRepository()
    tokens = InMemoryRefreshTokenRepository()
    svc = DefaultAuthService(
        identity=identity,
        users=users,
        tokens=tokens,
        access=JwtAccessTokenService("s", timedelta(minutes=15), clock=lambda: now),
        refresh=SecretsRefreshTokenCodec(),
        clock=lambda: now,
        refresh_ttl=timedelta(days=30),
    )
    return svc, users, tokens


def test_login_creates_user_on_first_time() -> None:
    svc, users, _ = _service()
    result = svc.login_with_google("id-token")
    assert result.user.email == "a@b.com"
    assert users.get_by_google_sub("g-1") is not None
    assert result.access_token and result.refresh_token


def test_login_returns_existing_user_second_time() -> None:
    svc, users, _ = _service()
    first = svc.login_with_google("id-token")
    second = svc.login_with_google("id-token")
    assert first.user.id == second.user.id
    assert len(users.all()) == 1


def test_refresh_rotates_and_keeps_family() -> None:
    svc, _, tokens = _service()
    login = svc.login_with_google("id-token")
    refreshed = svc.refresh(login.refresh_token)
    assert refreshed.refresh_token != login.refresh_token
    # old token now consumed, new token active, same family
    assert len({t.family_id for t in tokens.all()}) == 1


def test_replaying_consumed_token_revokes_whole_family() -> None:
    svc, _, tokens = _service()
    login = svc.login_with_google("id-token")
    svc.refresh(login.refresh_token)  # consumes the original
    with pytest.raises(RefreshReuseError):
        svc.refresh(login.refresh_token)  # replay the consumed one
    assert tokens.all() == []  # family wiped


def test_unknown_refresh_is_rejected() -> None:
    svc, _, _ = _service()
    with pytest.raises(InvalidRefreshError):
        svc.refresh("not-a-real-token")


def test_expired_refresh_is_rejected() -> None:
    now = [datetime(2026, 1, 1, tzinfo=UTC)]
    identity = StubIdentity(
        ExternalIdentity(subject="g-1", email="a@b.com", display_name="Ada", avatar_url=None)
    )
    users = InMemoryUserRepository()
    tokens = InMemoryRefreshTokenRepository()
    svc = DefaultAuthService(
        identity=identity,
        users=users,
        tokens=tokens,
        access=JwtAccessTokenService("s", timedelta(minutes=15), clock=lambda: now[0]),
        refresh=SecretsRefreshTokenCodec(),
        clock=lambda: now[0],
        refresh_ttl=timedelta(days=30),
    )
    login = svc.login_with_google("id-token")
    now[0] = datetime(2027, 1, 1, tzinfo=UTC)  # past the refresh ttl
    with pytest.raises(InvalidRefreshError):
        svc.refresh(login.refresh_token)


def test_logout_is_idempotent() -> None:
    svc, _, tokens = _service()
    login = svc.login_with_google("id-token")
    svc.logout(login.refresh_token)
    assert tokens.all() == []
    svc.logout(login.refresh_token)  # no error on second call
