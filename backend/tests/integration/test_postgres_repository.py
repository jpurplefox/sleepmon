"""Tests del adapter Postgres. Requieren una base real (docker compose).

Corren contra la base de test dedicada (ver ``conftest.py``), nunca contra la de
desarrollo. Se saltan solos si no hay Postgres accesible. Marcados ``integration``.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresTeamRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import User
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill

pytestmark = pytest.mark.integration


def _make_user(**overrides: object) -> User:
    defaults: dict[str, object] = {
        "id": uuid4(),
        "google_sub": str(uuid4()),
        "email": "owner@x.test",
        "display_name": "Owner",
        "avatar_url": None,
        "created_at": datetime.now(UTC),
    }
    defaults.update(overrides)
    return User(**defaults)  # type: ignore[arg-type]


@pytest.fixture
def user_id(test_dsn: str) -> UUID:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")  # cascades to team_member
    user = _make_user()
    PostgresUserRepository(pool).add(user)
    pool.close()
    return user.id


@pytest.fixture
def repo(test_dsn: str, user_id: UUID) -> Iterator[PostgresTeamRepository]:
    pool = create_pool(test_dsn)
    try:
        yield PostgresTeamRepository(pool)
    finally:
        with pool.connection() as conn:
            conn.execute("TRUNCATE app_user CASCADE")
        pool.close()


def sample() -> TeamMember:
    return TeamMember(
        species="Pikachu",
        level=60,
        nature=Nature.ADAMANT,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        sub_skills=(SubSkill.HELPING_SPEED_S, SubSkill.INVENTORY_UP_S),
        ribbon=Ribbon.SLEEP_500,
    )


def test_add_and_get_roundtrip(repo: PostgresTeamRepository, user_id: UUID) -> None:
    member = sample()
    repo.add(member, user_id)
    fetched = repo.get(member.id, user_id)
    assert fetched == member


def test_list_returns_all(repo: PostgresTeamRepository, user_id: UUID) -> None:
    repo.add(sample(), user_id)
    repo.add(sample(), user_id)
    assert len(repo.list(user_id)) == 2


def test_update_replaces_children(repo: PostgresTeamRepository, user_id: UUID) -> None:
    member = sample()
    repo.add(member, user_id)
    changed = TeamMember(
        id=member.id,
        species="Pikachu",
        level=30,
        nature=Nature.MODEST,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        sub_skills=(SubSkill.HELPING_BONUS,),
        ribbon=Ribbon.SLEEP_2000,
    )
    assert repo.update(changed, user_id) is True
    fetched = repo.get(member.id, user_id)
    assert fetched is not None
    assert fetched.nature is Nature.MODEST
    assert fetched.ingredients == (
        Ingredient.FANCY_APPLE,
        Ingredient.WARMING_GINGER,
        Ingredient.FANCY_EGG,
    )
    assert fetched.sub_skills == (SubSkill.HELPING_BONUS,)
    assert fetched.ribbon is Ribbon.SLEEP_2000


def test_delete_removes_member(repo: PostgresTeamRepository, user_id: UUID) -> None:
    member = sample()
    repo.add(member, user_id)
    assert repo.delete(member.id, user_id) is True
    assert repo.get(member.id, user_id) is None
    assert repo.delete(member.id, user_id) is False


def test_skill_level_roundtrips(repo: PostgresTeamRepository, user_id: UUID) -> None:
    member = TeamMember(
        species="Crustle",
        level=60,
        nature=Nature.MODEST,
        ingredients=(Ingredient.GLOSSY_AVOCADO, Ingredient.SOFT_POTATO, Ingredient.PURE_OIL),
        skill_level=6,
    )
    repo.add(member, user_id)
    fetched = repo.get(member.id, user_id)
    assert fetched is not None
    assert fetched.skill_level == 6
    assert fetched == member


def test_update_changes_skill_level(repo: PostgresTeamRepository, user_id: UUID) -> None:
    member = sample()  # skill_level por defecto = 1
    repo.add(member, user_id)
    changed = TeamMember(
        id=member.id,
        species=member.species,
        level=member.level,
        nature=member.nature,
        ingredients=member.ingredients,
        sub_skills=member.sub_skills,
        ribbon=member.ribbon,
        skill_level=7,
    )
    assert repo.update(changed, user_id) is True
    fetched = repo.get(member.id, user_id)
    assert fetched is not None
    assert fetched.skill_level == 7


def test_members_are_isolated_per_user(test_dsn: str) -> None:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")  # cascades to team_member
    users = PostgresUserRepository(pool)
    a = _make_user(email="a@x")
    b = _make_user(email="b@x")
    users.add(a)
    users.add(b)
    repo = PostgresTeamRepository(pool)
    m = sample()
    repo.add(m, a.id)
    assert [x.id for x in repo.list(a.id)] == [m.id]
    assert repo.list(b.id) == []  # B sees nothing
    assert repo.get(m.id, b.id) is None  # B can't read A's member by id
    assert repo.update(m, b.id) is False  # B can't update it
    assert repo.delete(m.id, b.id) is False  # B can't delete it
    assert repo.get(m.id, a.id) is not None  # A still has it
    pool.close()
