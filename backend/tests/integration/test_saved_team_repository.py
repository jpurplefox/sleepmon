"""Tests of the Postgres saved-team adapter. Require a real database (docker compose).

Run against the dedicated test database (see ``conftest.py``). Marked ``integration``.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresSavedTeamRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import User
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.saved_team import SavedSlot, SavedTeam
from sleepmon.domain.value_objects import Berry, Island, RecipeType, WeeklyBonus

pytestmark = pytest.mark.integration

START = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def pool(test_dsn: str) -> Iterator[ConnectionPool]:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")  # cascades to saved_team
    yield pool
    pool.close()


def _user(pool: ConnectionPool) -> UUID:
    user = User(
        id=uuid4(),
        google_sub=str(uuid4()),
        email="owner@x.test",
        display_name="Owner",
        avatar_url=None,
        created_at=datetime.now(UTC),
    )
    PostgresUserRepository(pool).add(user)
    return user.id


@pytest.fixture
def user_id(pool: ConnectionPool) -> UUID:
    return _user(pool)


@pytest.fixture
def repo(pool: ConnectionPool) -> PostgresSavedTeamRepository:
    return PostgresSavedTeamRepository(pool)


def team(name: str = "Cyan curry", minutes: int = 0, **overrides: object) -> SavedTeam:
    a, b = uuid4(), uuid4()
    values: dict[str, object] = {
        "id": uuid4(),
        "name": name,
        "slots": (SavedSlot((a,)), SavedSlot((a, b), 0.6)),
        "island": Island.CYAN_BEACH,
        "favorite_berries": (Berry.ORAN, Berry.PECHA, Berry.LEPPA),
        "main_favorite": Berry.ORAN,
        "weekly_bonus": WeeklyBonus.INGREDIENT,
        "dish_type": RecipeType.CURRY,
        "meals": ("Fancy Apple Curry", None, "Beanburger Curry"),
        "saved_at": START + timedelta(minutes=minutes),
    }
    values.update(overrides)
    return SavedTeam(**values)  # type: ignore[arg-type]


def test_round_trip(repo: PostgresSavedTeamRepository, user_id: UUID) -> None:
    saved = team()
    repo.add(saved, user_id)
    assert repo.get(saved.id, user_id) == saved
    assert repo.list(user_id) == [saved]


def test_nulls_round_trip(repo: PostgresSavedTeamRepository, user_id: UUID) -> None:
    bare = team(
        island=None,
        favorite_berries=(),
        main_favorite=None,
        dish_type=None,
        meals=(None, None, None),
    )
    repo.add(bare, user_id)
    assert repo.get(bare.id, user_id) == bare


def test_list_is_most_recently_saved_first(
    repo: PostgresSavedTeamRepository, user_id: UUID
) -> None:
    old, new, mid = team("Old", 0), team("New", 20), team("Mid", 10)
    for t in (old, new, mid):
        repo.add(t, user_id)
    assert [t.name for t in repo.list(user_id)] == ["New", "Mid", "Old"]


def test_teams_are_isolated_by_user(
    repo: PostgresSavedTeamRepository, pool: ConnectionPool, user_id: UUID
) -> None:
    other = _user(pool)
    mine = team()
    repo.add(mine, user_id)
    assert repo.list(other) == []
    assert repo.get(mine.id, other) is None
    assert repo.update(replace(mine, name="Stolen"), other) is False
    assert repo.delete(mine.id, other) is False
    assert repo.get(mine.id, user_id) == mine


def test_update_replaces_the_row(repo: PostgresSavedTeamRepository, user_id: UUID) -> None:
    saved = team()
    repo.add(saved, user_id)
    changed = replace(
        saved,
        name="Taupe",
        slots=(SavedSlot((uuid4(),)),),
        island=None,
        dish_type=RecipeType.SALAD,
        saved_at=START + timedelta(hours=1),
    )
    assert repo.update(changed, user_id) is True
    assert repo.get(saved.id, user_id) == changed


def test_update_and_delete_of_a_missing_team(
    repo: PostgresSavedTeamRepository, user_id: UUID
) -> None:
    assert repo.update(team(), user_id) is False
    assert repo.delete(uuid4(), user_id) is False


def test_delete_removes_the_row(repo: PostgresSavedTeamRepository, user_id: UUID) -> None:
    saved = team()
    repo.add(saved, user_id)
    assert repo.delete(saved.id, user_id) is True
    assert repo.get(saved.id, user_id) is None


def test_the_unique_index_becomes_a_validation_error(
    repo: PostgresSavedTeamRepository, user_id: UUID
) -> None:
    repo.add(team("Cyan Curry"), user_id)
    with pytest.raises(ValidationError, match="Ya tenés un equipo llamado «cyan curry»"):
        repo.add(team("cyan curry"), user_id)

    taupe = team("Taupe")
    repo.add(taupe, user_id)
    with pytest.raises(ValidationError, match="Ya tenés un equipo llamado «CYAN CURRY»"):
        repo.update(replace(taupe, name="CYAN CURRY"), user_id)
    assert repo.get(taupe.id, user_id) == taupe


def test_another_user_may_use_the_same_name(
    repo: PostgresSavedTeamRepository, pool: ConnectionPool, user_id: UUID
) -> None:
    repo.add(team("Cyan curry"), user_id)
    other = _user(pool)
    repo.add(team("Cyan curry"), other)
    assert len(repo.list(other)) == 1


def test_unknown_enum_values_are_read_tolerantly(
    repo: PostgresSavedTeamRepository, pool: ConnectionPool, user_id: UUID
) -> None:
    saved = team()
    repo.add(saved, user_id)
    with pool.connection() as conn:
        conn.execute(
            "UPDATE saved_team SET island = %s, favorite_berries = %s, main_favorite = %s, "
            "weekly_bonus = %s, dish_type = %s WHERE id = %s",
            ("Atlantis", Jsonb(["Oran", "Gone"]), "Gone", "gone", "Soup", saved.id),
        )
    read = repo.get(saved.id, user_id)
    assert read is not None
    assert read.island is None
    assert read.favorite_berries == (Berry.ORAN,)
    assert read.main_favorite is None
    assert read.weekly_bonus is WeeklyBonus.BERRY_STRENGTH
    assert read.dish_type is None


def test_deleting_the_user_cascades(
    repo: PostgresSavedTeamRepository, pool: ConnectionPool, user_id: UUID
) -> None:
    repo.add(team(), user_id)
    with pool.connection() as conn:
        conn.execute("DELETE FROM app_user WHERE id = %s", (user_id,))
    assert repo.list(user_id) == []
