from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True, slots=True)
class ExternalIdentity:
    subject: str
    email: str
    display_name: str
    avatar_url: str | None


@dataclass(frozen=True, slots=True)
class User:
    id: UUID
    google_sub: str
    email: str
    display_name: str
    avatar_url: str | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class RefreshToken:
    id: UUID
    family_id: UUID
    user_id: UUID
    token_hash: str
    consumed: bool
    expires_at: datetime
    created_at: datetime


class InvalidCredentialError(Exception):
    """A Google ID token that failed verification."""


class InvalidTokenError(Exception):
    """An access token that is missing, expired, or tampered."""


class InvalidRefreshError(Exception):
    """A refresh token that is unknown or expired."""


class RefreshReuseError(InvalidRefreshError):
    """An already-consumed refresh token was replayed (theft signal)."""
