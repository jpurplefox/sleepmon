"""Adapter de persistencia: implementa ``TeamRepository`` con psycopg + PyPika."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TypeVar
from uuid import UUID

from psycopg import Cursor
from psycopg.rows import TupleRow, class_row
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres import queries
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.ports import TeamRepository
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill

_E = TypeVar("_E", bound=Enum)


@dataclass(frozen=True, slots=True)
class _MemberRow:
    """Fila de ``team_member`` (columnas: id, species, level, nature)."""

    id: UUID
    species: str
    level: int
    nature: str


@dataclass(frozen=True, slots=True)
class _SlotValueRow:
    """Fila de un hijo filtrado por miembro (columnas: slot, value)."""

    slot: int
    value: str


@dataclass(frozen=True, slots=True)
class _MemberSlotValueRow:
    """Fila de un hijo sin filtrar (columnas: member_id, slot, value)."""

    member_id: UUID
    slot: int
    value: str


def _decode(enum_cls: type[_E], value: str) -> _E:
    """Convierte un valor crudo de la DB a su enum, fallando con error de dominio
    si la base quedó con un valor que ya no existe en el juego."""
    try:
        return enum_cls(value)
    except ValueError as exc:
        raise ValidationError(
            f"Valor inválido en la base: {value!r} para {enum_cls.__name__}."
        ) from exc


class PostgresTeamRepository(TeamRepository):
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def add(self, member: TeamMember) -> None:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                queries.INSERT_MEMBER,
                (member.id, member.species, member.level, member.nature.value),
            )
            self._insert_children(cur, member)

    def get(self, member_id: UUID) -> TeamMember | None:
        with self._pool.connection() as conn:
            with conn.cursor(row_factory=class_row(_MemberRow)) as cur:
                cur.execute(queries.SELECT_MEMBER_BY_ID, (member_id,))
                row = cur.fetchone()
            if row is None:
                return None
            with conn.cursor(row_factory=class_row(_SlotValueRow)) as cur:
                cur.execute(queries.SELECT_SUBSKILLS_BY_MEMBER, (member_id,))
                subs = tuple(_decode(SubSkill, r.value) for r in cur.fetchall())
                cur.execute(queries.SELECT_INGREDIENTS_BY_MEMBER, (member_id,))
                ings = tuple(_decode(Ingredient, r.value) for r in cur.fetchall())
        return _build_member(row, subs, ings)

    def list(self) -> list[TeamMember]:
        with self._pool.connection() as conn:
            with conn.cursor(row_factory=class_row(_MemberRow)) as cur:
                cur.execute(queries.SELECT_MEMBERS_ALL)
                rows = cur.fetchall()
            with conn.cursor(row_factory=class_row(_MemberSlotValueRow)) as cur:
                cur.execute(queries.SELECT_SUBSKILLS_ALL)
                subs_by_member = _group(cur.fetchall())
                cur.execute(queries.SELECT_INGREDIENTS_ALL)
                ings_by_member = _group(cur.fetchall())

        members: list[TeamMember] = []
        for row in rows:
            subs = tuple(_decode(SubSkill, v) for v in subs_by_member.get(row.id, []))
            ings = tuple(_decode(Ingredient, v) for v in ings_by_member.get(row.id, []))
            members.append(_build_member(row, subs, ings))
        return members

    def update(self, member: TeamMember) -> bool:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                queries.UPDATE_MEMBER,
                (member.species, member.level, member.nature.value, member.id),
            )
            if cur.rowcount == 0:
                return False
            cur.execute(queries.DELETE_SUBSKILLS_BY_MEMBER, (member.id,))
            cur.execute(queries.DELETE_INGREDIENTS_BY_MEMBER, (member.id,))
            self._insert_children(cur, member)
            return True

    def delete(self, member_id: UUID) -> bool:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(queries.DELETE_MEMBER, (member_id,))
            return cur.rowcount > 0

    @staticmethod
    def _insert_children(cur: Cursor[TupleRow], member: TeamMember) -> None:
        if member.sub_skills:
            cur.executemany(
                queries.INSERT_SUBSKILL,
                [(member.id, slot, s.value) for slot, s in enumerate(member.sub_skills)],
            )
        cur.executemany(
            queries.INSERT_INGREDIENT,
            [(member.id, slot, i.value) for slot, i in enumerate(member.ingredients)],
        )


def _group(rows: list[_MemberSlotValueRow]) -> dict[UUID, list[str]]:
    """Agrupa filas (member_id, slot, value) por member_id, ya ordenadas por slot."""
    grouped: dict[UUID, list[str]] = {}
    for row in rows:
        grouped.setdefault(row.member_id, []).append(row.value)
    return grouped


def _build_member(
    row: _MemberRow,
    sub_skills: tuple[SubSkill, ...],
    ingredients: tuple[Ingredient, ...],
) -> TeamMember:
    return TeamMember(
        id=row.id,
        species=row.species,
        level=row.level,
        nature=_decode(Nature, row.nature),
        ingredients=ingredients,
        sub_skills=sub_skills,
    )
