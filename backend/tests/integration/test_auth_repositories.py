"""Tests de los adapters Postgres de autenticación. Requieren una base real (docker
compose). Corren contra la base de test dedicada (ver ``conftest.py``), nunca contra
la de desarrollo. Se saltan solos si no hay Postgres accesible. Marcados ``integration``.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresPlayerProgressRepository,
    PostgresRefreshTokenRepository,
    PostgresSavedTeamRepository,
    PostgresTeamRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import RefreshToken, User
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.progress import PlayerProgress
from sleepmon.domain.saved_team import SavedSlot, SavedTeam
from sleepmon.domain.value_objects import (
    Berry,
    Ingredient,
    Nature,
    RecipeType,
    Ribbon,
    SubSkill,
    WeeklyBonus,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def pool(test_dsn: str) -> Iterator[ConnectionPool]:
    p = create_pool(test_dsn)
    with p.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")
    try:
        yield p
    finally:
        with p.connection() as conn:
            conn.execute("TRUNCATE app_user CASCADE")
        p.close()


def _user(google_sub: str = "g-1") -> User:
    return User(
        id=uuid4(),
        google_sub=google_sub,
        email="a@b.com",
        display_name="Ada",
        avatar_url=None,
        created_at=datetime.now(UTC),
    )


def test_user_add_and_lookup_by_sub(pool: ConnectionPool) -> None:
    repo = PostgresUserRepository(pool)
    u = _user()
    repo.add(u)

    fetched_by_sub = repo.get_by_google_sub("g-1")
    assert fetched_by_sub is not None
    assert fetched_by_sub.id == u.id

    fetched_by_id = repo.get(u.id)
    assert fetched_by_id is not None
    assert fetched_by_id.email == "a@b.com"

    assert repo.get_by_google_sub("missing") is None


def test_refresh_add_find_consume_delete_family(pool: ConnectionPool) -> None:
    users = PostgresUserRepository(pool)
    tokens = PostgresRefreshTokenRepository(pool)
    u = _user()
    users.add(u)
    fam = uuid4()
    now = datetime.now(UTC)
    t = RefreshToken(
        id=uuid4(),
        family_id=fam,
        user_id=u.id,
        token_hash="h1",
        consumed=False,
        expires_at=now + timedelta(days=1),
        created_at=now,
    )
    tokens.add(t)

    found = tokens.find_by_hash("h1")
    assert found is not None
    assert found.id == t.id

    tokens.consume(t.id)
    consumed = tokens.find_by_hash("h1")
    assert consumed is not None
    assert consumed.consumed is True

    tokens.delete_family(fam)
    assert tokens.find_by_hash("h1") is None


def test_delete_expired_removes_only_past(pool: ConnectionPool) -> None:
    users = PostgresUserRepository(pool)
    tokens = PostgresRefreshTokenRepository(pool)
    u = _user()
    users.add(u)
    now = datetime.now(UTC)
    old = RefreshToken(
        id=uuid4(),
        family_id=uuid4(),
        user_id=u.id,
        token_hash="old",
        consumed=True,
        expires_at=now - timedelta(days=1),
        created_at=now,
    )
    live = RefreshToken(
        id=uuid4(),
        family_id=uuid4(),
        user_id=u.id,
        token_hash="live",
        consumed=False,
        expires_at=now + timedelta(days=1),
        created_at=now,
    )
    tokens.add(old)
    tokens.add(live)

    assert tokens.delete_expired(now) == 1
    assert tokens.find_by_hash("old") is None
    assert tokens.find_by_hash("live") is not None


def _member() -> TeamMember:
    return TeamMember(
        species="Pikachu",
        level=60,
        nature=Nature.ADAMANT,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        sub_skills=(SubSkill.HELPING_SPEED_S, SubSkill.INVENTORY_UP_S),
        ribbon=Ribbon.SLEEP_500,
    )


def _saved_team(member_id: UUID) -> SavedTeam:
    return SavedTeam(
        id=uuid4(),
        name="Cyan curry",
        slots=(SavedSlot((member_id,)),),
        island=None,
        favorite_berries=(Berry.ORAN,),
        main_favorite=Berry.ORAN,
        weekly_bonus=WeeklyBonus.INGREDIENT,
        dish_type=RecipeType.CURRY,
        meals=(None, None, None),
        saved_at=datetime.now(UTC),
    )


def _token(user_id: UUID, token_hash: str) -> RefreshToken:
    now = datetime.now(UTC)
    return RefreshToken(
        id=uuid4(),
        family_id=uuid4(),
        user_id=user_id,
        token_hash=token_hash,
        consumed=False,
        expires_at=now + timedelta(days=1),
        created_at=now,
    )


def test_delete_user_cascades_to_their_data_only(pool: ConnectionPool) -> None:
    users = PostgresUserRepository(pool)
    members = PostgresTeamRepository(pool)
    progress = PostgresPlayerProgressRepository(pool)
    saved = PostgresSavedTeamRepository(pool)
    tokens = PostgresRefreshTokenRepository(pool)
    a, b = _user("g-a"), _user("g-b")
    users.add(a)
    users.add(b)

    member_a, member_b = _member(), _member()
    team_a, team_b = _saved_team(member_a.id), _saved_team(member_b.id)
    for owner, member, team, token_hash in (
        (a, member_a, team_a, "tok-a"),
        (b, member_b, team_b, "tok-b"),
    ):
        members.add(member, owner.id)
        progress.transform(owner.id, lambda _: PlayerProgress(pot_size=33))
        saved.add(team, owner.id)
        tokens.add(_token(owner.id, token_hash))

    assert users.delete(a.id) is True

    assert users.get(a.id) is None
    assert members.list(a.id) == []
    assert progress.get(a.id) == PlayerProgress()  # defaults: its row is gone
    assert saved.list(a.id) == []
    assert tokens.find_by_hash("tok-a") is None

    assert users.get(b.id) is not None
    assert members.get(member_b.id, b.id) is not None
    assert progress.get(b.id).pot_size == 33
    assert saved.get(team_b.id, b.id) is not None
    assert tokens.find_by_hash("tok-b") is not None

    assert users.delete(a.id) is False
