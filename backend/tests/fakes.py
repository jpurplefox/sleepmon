"""Dobles de prueba para correr la aplicación sin infraestructura."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from uuid import UUID

from sleepmon.domain.auth import RefreshToken, User
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.ports import RefreshTokenRepository, TeamRepository, UserRepository


class InMemoryTeamRepository(TeamRepository):
    """Repo en memoria, suficiente para testear la aplicación y el borde HTTP."""

    def __init__(self) -> None:
        self._members: dict[UUID, TeamMember] = {}

    def add(self, member: TeamMember) -> None:
        self._members[member.id] = member

    def get(self, member_id: UUID) -> TeamMember | None:
        return self._members.get(member_id)

    def list(self) -> list[TeamMember]:
        return list(self._members.values())

    def update(self, member: TeamMember) -> bool:
        if member.id not in self._members:
            return False
        self._members[member.id] = member
        return True

    def delete(self, member_id: UUID) -> bool:
        return self._members.pop(member_id, None) is not None


class InMemoryUserRepository(UserRepository):
    """Repo en memoria de usuarios, suficiente para testear la aplicación."""

    def __init__(self) -> None:
        self._by_id: dict[UUID, User] = {}

    def get_by_google_sub(self, sub: str) -> User | None:
        return next((u for u in self._by_id.values() if u.google_sub == sub), None)

    def get(self, user_id: UUID) -> User | None:
        return self._by_id.get(user_id)

    def add(self, user: User) -> None:
        self._by_id[user.id] = user

    def all(self) -> list[User]:
        return list(self._by_id.values())


class InMemoryRefreshTokenRepository(RefreshTokenRepository):
    """Repo en memoria de refresh tokens, con revocación de familia completa."""

    def __init__(self) -> None:
        self._by_id: dict[UUID, RefreshToken] = {}

    def add(self, token: RefreshToken) -> None:
        self._by_id[token.id] = token

    def find_by_hash(self, token_hash: str) -> RefreshToken | None:
        return next((t for t in self._by_id.values() if t.token_hash == token_hash), None)

    def consume(self, token_id: UUID) -> None:
        token = self._by_id[token_id]
        self._by_id[token_id] = replace(token, consumed=True)

    def delete_family(self, family_id: UUID) -> None:
        self._by_id = {i: t for i, t in self._by_id.items() if t.family_id != family_id}

    def delete_expired(self, now: datetime) -> int:
        expired = [i for i, t in self._by_id.items() if t.expires_at <= now]
        for i in expired:
            del self._by_id[i]
        return len(expired)

    def all(self) -> list[RefreshToken]:
        return list(self._by_id.values())
