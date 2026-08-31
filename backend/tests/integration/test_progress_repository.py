"""Tests del adapter Postgres de progreso. Requieren una base real (docker compose).

Corren contra la base de test dedicada (ver ``conftest.py``). Marcados ``integration``.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresPlayerProgressRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import User
from sleepmon.domain.progress import PlayerProgress
from sleepmon.domain.value_objects import Island, RecipeType

pytestmark = pytest.mark.integration


@pytest.fixture
def user_id(test_dsn: str) -> UUID:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")  # cascades to player_progress
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
def repo(test_dsn: str) -> PostgresPlayerProgressRepository:
    return PostgresPlayerProgressRepository(create_pool(test_dsn))


def test_a_missing_row_reads_the_defaults(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    assert repo.get(user_id) == PlayerProgress()


def test_reading_a_missing_row_writes_nothing(
    repo: PostgresPlayerProgressRepository, user_id: UUID, test_dsn: str
) -> None:
    repo.get(user_id)
    with create_pool(test_dsn).connection() as conn:
        rows = conn.execute("SELECT count(*) FROM player_progress").fetchone()
    assert rows is not None and rows[0] == 0


def test_the_first_transform_inserts(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    stored = repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    assert stored.pot_size == 33
    assert repo.get(user_id).pot_size == 33


def test_a_second_transform_updates_and_sees_the_first(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    stored = repo.transform(
        user_id,
        lambda current: PlayerProgress(
            pot_size=current.pot_size, area_bonuses={Island.CYAN_BEACH: 42}
        ),
    )
    assert stored.pot_size == 33
    assert repo.get(user_id).area_bonuses == {Island.CYAN_BEACH: 42}


def test_every_mapping_round_trips(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    saved = PlayerProgress(
        pot_size=36,
        recipe_levels={"Beanburger Curry": 55},
        favorite_recipes={RecipeType.CURRY: "Beanburger Curry"},
        area_bonuses={Island.CYAN_BEACH: 42, Island.GREENGRASS_EXPERT: 35},
    )
    repo.transform(user_id, lambda _: saved)
    assert repo.get(user_id) == saved


def test_a_key_removed_really_disappears(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(recipe_levels={"Beanburger Curry": 30}))
    repo.transform(user_id, lambda _: PlayerProgress())
    assert repo.get(user_id).recipe_levels == {}


def test_a_raising_change_leaves_the_row_untouched(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))

    def explode(_: PlayerProgress) -> PlayerProgress:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        repo.transform(user_id, explode)
    assert repo.get(user_id).pot_size == 33


def test_an_unknown_key_in_the_stored_json_is_dropped_on_read(
    repo: PostgresPlayerProgressRepository, user_id: UUID, test_dsn: str
) -> None:
    # A recipe or area the catalogue no longer has must not turn the screen into a 500.
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    with create_pool(test_dsn).connection() as conn:
        conn.execute(
            "UPDATE player_progress SET area_bonuses = %s::jsonb, "
            "recipe_levels = %s::jsonb WHERE user_id = %s",
            ('{"Atlantis": 40}', '{"Removed Stew": 30}', user_id),
        )
    progress = repo.get(user_id)
    assert progress.area_bonuses == {}
    assert progress.recipe_levels == {"Removed Stew": 30}


def test_the_row_dies_with_its_user(
    repo: PostgresPlayerProgressRepository, user_id: UUID, test_dsn: str
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("DELETE FROM app_user WHERE id = %s", (user_id,))
        rows = conn.execute("SELECT count(*) FROM player_progress").fetchone()
    assert rows is not None and rows[0] == 0
