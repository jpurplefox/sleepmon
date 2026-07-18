from datetime import UTC, datetime
from uuid import uuid4

import pytest

from sleepmon.domain.auth import (
    ExternalIdentity,
    InvalidRefreshError,
    RefreshReuseError,
    RefreshToken,
    User,
)


def test_entities_are_frozen() -> None:
    u = User(
        id=uuid4(), google_sub="sub", email="a@b.com", display_name="A",
        avatar_url=None, created_at=datetime.now(UTC),
    )
    with pytest.raises(AttributeError):
        u.email = "x@y.com"  # type: ignore[misc]


def test_external_identity_holds_google_claims() -> None:
    ident = ExternalIdentity(subject="123", email="a@b.com", display_name="A", avatar_url="http://p")
    assert ident.subject == "123"


def test_reuse_error_is_a_refresh_error() -> None:
    assert issubclass(RefreshReuseError, InvalidRefreshError)


def test_refresh_token_carries_family_and_consumed_flag() -> None:
    t = RefreshToken(
        id=uuid4(), family_id=uuid4(), user_id=uuid4(),
        token_hash="deadbeef", consumed=False,
        expires_at=datetime.now(UTC), created_at=datetime.now(UTC),
    )
    assert t.consumed is False
