"""Adapter de persistencia: implementa ``TeamRepository`` con psycopg + PyPika."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import TypeVar
from uuid import UUID

from psycopg import Cursor
from psycopg.rows import TupleRow, class_row
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres import queries
from sleepmon.domain.auth import RefreshToken, User
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.ports import RefreshTokenRepository, TeamRepository, UserRepository
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill

_E = TypeVar("_E", bound=Enum)


@dataclass(frozen=True, slots=True)
class _MemberRow:
    """Fila de ``team_member`` (columnas: id, species, level, nature, ribbon, skill_level)."""

    id: UUID
    species: str
    level: int
    nature: str
    ribbon: str
    skill_level: int


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
                (
                    member.id,
                    member.species,
                    member.level,
                    member.nature.value if member.nature else "",
                    member.ribbon.value,
                    member.skill_level,
                ),
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
                (
                    member.species,
                    member.level,
                    member.nature.value if member.nature else "",
                    member.ribbon.value,
                    member.skill_level,
                    member.id,
                ),
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


@dataclass(frozen=True, slots=True)
class _UserRow:
    """Fila de ``app_user`` (columnas: id, google_sub, email, display_name, avatar_url,
    created_at)."""

    id: UUID
    google_sub: str
    email: str
    display_name: str
    avatar_url: str | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class _RefreshRow:
    """Fila de ``refresh_token`` (columnas: id, family_id, user_id, token_hash, consumed,
    expires_at, created_at)."""

    id: UUID
    family_id: UUID
    user_id: UUID
    token_hash: str
    consumed: bool
    expires_at: datetime
    created_at: datetime


class PostgresUserRepository(UserRepository):
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def add(self, user: User) -> None:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                queries.INSERT_USER,
                (
                    user.id,
                    user.google_sub,
                    user.email,
                    user.display_name,
                    user.avatar_url,
                    user.created_at,
                ),
            )

    def _fetch(self, sql: str, param: object) -> User | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=class_row(_UserRow)) as cur:
            cur.execute(sql, (param,))
            row = cur.fetchone()
        if row is None:
            return None
        return User(
            id=row.id,
            google_sub=row.google_sub,
            email=row.email,
            display_name=row.display_name,
            avatar_url=row.avatar_url,
            created_at=row.created_at,
        )

    def get_by_google_sub(self, sub: str) -> User | None:
        return self._fetch(queries.SELECT_USER_BY_SUB, sub)

    def get(self, user_id: UUID) -> User | None:
        return self._fetch(queries.SELECT_USER_BY_ID, user_id)


class PostgresRefreshTokenRepository(RefreshTokenRepository):
    def __init__(self, pool: ConnectionPool) -> None:
        self._pool = pool

    def add(self, token: RefreshToken) -> None:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                queries.INSERT_REFRESH,
                (
                    token.id,
                    token.family_id,
                    token.user_id,
                    token.token_hash,
                    token.consumed,
                    token.expires_at,
                    token.created_at,
                ),
            )

    def find_by_hash(self, token_hash: str) -> RefreshToken | None:
        with (
            self._pool.connection() as conn,
            conn.cursor(row_factory=class_row(_RefreshRow)) as cur,
        ):
            cur.execute(queries.SELECT_REFRESH_BY_HASH, (token_hash,))
            row = cur.fetchone()
        if row is None:
            return None
        return RefreshToken(
            id=row.id,
            family_id=row.family_id,
            user_id=row.user_id,
            token_hash=row.token_hash,
            consumed=row.consumed,
            expires_at=row.expires_at,
            created_at=row.created_at,
        )

    def consume(self, token_id: UUID) -> None:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(queries.CONSUME_REFRESH, (token_id,))

    def delete_family(self, family_id: UUID) -> None:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(queries.DELETE_REFRESH_FAMILY, (family_id,))

    def delete_expired(self, now: datetime) -> int:
        with self._pool.connection() as conn, conn.cursor() as cur:
            cur.execute(queries.DELETE_REFRESH_EXPIRED, (now,))
            return cur.rowcount


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
        nature=_decode(Nature, row.nature) if row.nature else None,
        ingredients=ingredients,
        sub_skills=sub_skills,
        ribbon=_decode(Ribbon, row.ribbon),
        skill_level=row.skill_level,
    )
