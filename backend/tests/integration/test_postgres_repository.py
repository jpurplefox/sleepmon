"""Tests del adapter Postgres. Requieren una base real (docker compose).

Corren contra la base de test dedicada (ver ``conftest.py``), nunca contra la de
desarrollo. Se saltan solos si no hay Postgres accesible. Marcados ``integration``.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import PostgresTeamRepository
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill

pytestmark = pytest.mark.integration


@pytest.fixture
def repo(test_dsn: str) -> Iterator[PostgresTeamRepository]:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE team_member CASCADE")
    try:
        yield PostgresTeamRepository(pool)
    finally:
        with pool.connection() as conn:
            conn.execute("TRUNCATE team_member CASCADE")
        pool.close()


def sample() -> TeamMember:
    return TeamMember(
        species="Pikachu",
        level=60,
        nature=Nature.ADAMANT,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER),
        sub_skills=(SubSkill.HELPING_SPEED_S, SubSkill.INVENTORY_UP_S),
        ribbon=Ribbon.SLEEP_500,
    )


def test_add_and_get_roundtrip(repo: PostgresTeamRepository) -> None:
    member = sample()
    repo.add(member)
    fetched = repo.get(member.id)
    assert fetched == member


def test_list_returns_all(repo: PostgresTeamRepository) -> None:
    repo.add(sample())
    repo.add(sample())
    assert len(repo.list()) == 2


def test_update_replaces_children(repo: PostgresTeamRepository) -> None:
    member = sample()
    repo.add(member)
    changed = TeamMember(
        id=member.id,
        species="Pikachu",
        level=30,
        nature=Nature.MODEST,
        ingredients=(Ingredient.FANCY_APPLE,),
        sub_skills=(SubSkill.HELPING_BONUS,),
        ribbon=Ribbon.SLEEP_2000,
    )
    assert repo.update(changed) is True
    fetched = repo.get(member.id)
    assert fetched is not None
    assert fetched.nature is Nature.MODEST
    assert fetched.ingredients == (Ingredient.FANCY_APPLE,)
    assert fetched.sub_skills == (SubSkill.HELPING_BONUS,)
    assert fetched.ribbon is Ribbon.SLEEP_2000


def test_delete_removes_member(repo: PostgresTeamRepository) -> None:
    member = sample()
    repo.add(member)
    assert repo.delete(member.id) is True
    assert repo.get(member.id) is None
    assert repo.delete(member.id) is False
