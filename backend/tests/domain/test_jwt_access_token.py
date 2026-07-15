from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from sleepmon.adapters.outbound.auth.jwt_access_token import JwtAccessTokenService
from sleepmon.domain.auth import InvalidTokenError


def test_issue_then_verify_roundtrips_user_id() -> None:
    svc = JwtAccessTokenService(secret="s", ttl=timedelta(minutes=15))
    uid = uuid4()
    token = svc.issue(uid)
    assert svc.verify(token) == uid


def test_expired_token_is_rejected() -> None:
    past = datetime(2000, 1, 1, tzinfo=timezone.utc)  # noqa: UP017 (support Python 3.11)
    svc = JwtAccessTokenService(secret="s", ttl=timedelta(minutes=15), clock=lambda: past)
    token = svc.issue(uuid4())
    fresh = JwtAccessTokenService(secret="s", ttl=timedelta(minutes=15))
    with pytest.raises(InvalidTokenError):
        fresh.verify(token)


def test_tampered_or_wrong_secret_is_rejected() -> None:
    token = JwtAccessTokenService(secret="s", ttl=timedelta(minutes=15)).issue(uuid4())
    with pytest.raises(InvalidTokenError):
        JwtAccessTokenService(secret="other", ttl=timedelta(minutes=15)).verify(token)
