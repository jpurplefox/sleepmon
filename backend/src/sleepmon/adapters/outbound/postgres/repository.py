"""Adapter de persistencia: implementa ``TeamRepository`` con psycopg + PyPika."""

from __future__ import annotations

from enum import Enum
from typing import TypeVar
from uuid import UUID

from psycopg import Cursor
from psycopg.rows import TupleRow
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres import queries
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.ports import TeamRepository
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill

_E = TypeVar("_E", bound=Enum)


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
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(queries.SELECT_MEMBER_BY_ID, (member_id,))
            row = cur.fetchone()
            if row is None:
                return None
            cur.execute(queries.SELECT_SUBSKILLS_BY_MEMBER, (member_id,))
            subs = tuple(_decode(SubSkill, value) for _slot, value in cur.fetchall())
            cur.execute(queries.SELECT_INGREDIENTS_BY_MEMBER, (member_id,))
            ings = tuple(_decode(Ingredient, value) for _slot, value in cur.fetchall())
            return _build_member(row, subs, ings)

    def list(self) -> list[TeamMember]:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(queries.SELECT_MEMBERS_ALL)
            rows = cur.fetchall()
            cur.execute(queries.SELECT_SUBSKILLS_ALL)
            subs_by_member = _group(cur.fetchall())
            cur.execute(queries.SELECT_INGREDIENTS_ALL)
            ings_by_member = _group(cur.fetchall())

        members: list[TeamMember] = []
        for row in rows:
            member_id = row[0]
            subs = tuple(_decode(SubSkill, v) for v in subs_by_member.get(member_id, []))
            ings = tuple(_decode(Ingredient, v) for v in ings_by_member.get(member_id, []))
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


def _group(rows: list[tuple[UUID, int, str]]) -> dict[UUID, list[str]]:
    """Agrupa filas (member_id, slot, valor) por member_id, ya ordenadas por slot."""
    grouped: dict[UUID, list[str]] = {}
    for member_id, _slot, value in rows:
        grouped.setdefault(member_id, []).append(value)
    return grouped


def _build_member(
    row: tuple[UUID, str, int, str],
    sub_skills: tuple[SubSkill, ...],
    ingredients: tuple[Ingredient, ...],
) -> TeamMember:
    member_id, species, level, nature = row
    return TeamMember(
        id=member_id,
        species=species,
        level=level,
        nature=_decode(Nature, nature),
        ingredients=ingredients,
        sub_skills=sub_skills,
    )
