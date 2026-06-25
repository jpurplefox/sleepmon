"""Dobles de prueba para correr la aplicación sin infraestructura."""

from __future__ import annotations

from uuid import UUID

from sleepmon.domain.entities import TeamMember
from sleepmon.domain.ports import TeamRepository


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
